"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  HouseIcon,
  ListIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { Form } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DemoOrder } from "@/lib/orders/demo-data"
import { useDemoInventory } from "@/lib/inventory/use-demo-inventory"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"
import { createSupabaseOrder } from "@/lib/orders/supabase-orders"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"

const priceAdjustmentSchema = z.object({
  type: z.enum(["surcharge", "discount"]),
  mode: z.enum(["fixed", "percent"]),
  value: z.number().min(0, "El ajuste no puede ser negativo."),
  note: z.string(),
  enabled: z.boolean(),
})

const garmentItemSchema = z.object({
  garment: z.string().min(1, "Selecciona una prenda."),
  fit: z.string().min(1, "Selecciona una horma."),
  color: z.string().trim().min(1, "Selecciona un color."),
  size: z.string().trim().min(1, "Indica una talla."),
  name: z.string(),
  number: z.string(),
  notes: z.string(),
  unitPrice: z.number().min(0, "El precio no puede ser negativo."),
  priceManuallyEdited: z.boolean(),
  adjustment: priceAdjustmentSchema,
})

const orderSchema = z.object({
  customer: z.string().trim().min(2, "Ingresa el nombre del cliente."),
  note: z.string(),
  entryDate: z.string().min(1, "Selecciona la fecha de ingreso."),
  dueDate: z.string().min(1, "Selecciona la fecha pactada."),
  salesperson: z.string().trim().min(1, "Selecciona o escribe un vendedor."),
  garments: z.array(z.object({
    type: z.string().min(1, "Selecciona una prenda."),
    fit: z.string().min(1, "Selecciona una horma."),
    quantity: z.number().int().min(1, "La cantidad debe ser al menos 1."),
  })).min(1, "Agrega al menos un tipo de prenda."),
  items: z.array(garmentItemSchema).min(1, "Agrega al menos una fila de personalización."),
  paymentStatus: z.enum(["Pendiente", "Abonado", "Pagado"]),
  paid: z.number().min(0, "El abono no puede ser negativo."),
  paymentMethod: z.string(),
}).refine((values) => values.dueDate >= values.entryDate, {
  message: "La fecha de entrega debe ser igual o posterior al ingreso.",
  path: ["dueDate"],
}).superRefine((values, context) => {
  const totals = calculateTotals(values.items)
  if (values.items.some((item) => item.adjustment.enabled
    && item.adjustment.type === "discount"
    && item.adjustment.mode === "percent"
    && item.adjustment.value > 100)) {
    context.addIssue({
      code: "custom",
      message: "El descuento porcentual no puede superar el 100%.",
      path: ["items"],
    })
  }

  if (values.items.some((item) => item.adjustment.enabled
    && item.adjustment.type === "discount"
    && item.adjustment.mode === "fixed"
    && item.adjustment.value > item.unitPrice + surchargeFor(item))) {
    context.addIssue({
      code: "custom",
      message: "El descuento fijo no puede superar el valor de la prenda.",
      path: ["items"],
    })
  }

  if (values.paid > totals.grandTotal) {
    context.addIssue({
      code: "custom",
      message: "El abono no puede ser mayor al total del pedido.",
      path: ["paid"],
    })
  }
  if (values.paymentStatus === "Pendiente" && values.paid !== 0) {
    context.addIssue({
      code: "custom",
      message: "Un pedido pendiente no puede tener un abono registrado.",
      path: ["paid"],
    })
  }
  if (values.paymentStatus === "Abonado" && (values.paid <= 0 || values.paid >= totals.grandTotal)) {
    context.addIssue({
      code: "custom",
      message: "El abono debe ser mayor a cero y menor al total.",
      path: ["paid"],
    })
  }
  if (values.paymentStatus === "Pagado" && values.paid !== totals.grandTotal) {
    context.addIssue({
      code: "custom",
      message: "El monto abonado debe coincidir con el total para marcar el pedido como pagado.",
      path: ["paid"],
    })
  }
  if (values.paid > 0 && !values.paymentMethod) {
    context.addIssue({
      code: "custom",
      message: "Selecciona el método de pago del abono.",
      path: ["paymentMethod"],
    })
  }
})

type OrderFormValues = z.infer<typeof orderSchema>

const steps = [
  { title: "Datos generales", detail: "Cliente y entrega" },
  { title: "Personalización", detail: "Prendas y trazabilidad" },
  { title: "Precios y ajustes", detail: "Importes por unidad" },
  { title: "Resumen y pago", detail: "Total y abono inicial" },
]

const defaultGarmentTypes = ["Camiseta", "Pantaloneta", "Sudadera", "Chaqueta", "Medias"]
const fits = ["Hombre", "Mujer", "Infantil"]
const defaultColors = ["Azul marino", "Blanco", "Negro"]
const defaultSizes = ["4", "6", "8", "10", "12", "14", "XS", "S", "M", "L", "XL", "XXL"]
const paymentMethods = ["Transferencia", "Efectivo", "Crédito"]
const customSalespersonValue = "__personalizado__"

type FormItem = z.infer<typeof garmentItemSchema>

function surchargeFor(item: FormItem) {
  if (!item.adjustment.enabled || item.adjustment.type !== "surcharge") return 0
  return item.adjustment.mode === "percent"
    ? item.unitPrice * item.adjustment.value / 100
    : item.adjustment.value
}

function discountFor(item: FormItem) {
  if (!item.adjustment.enabled || item.adjustment.type !== "discount") return 0
  const subtotal = item.unitPrice + surchargeFor(item)
  return item.adjustment.mode === "percent"
    ? subtotal * item.adjustment.value / 100
    : item.adjustment.value
}

function calculateTotals(items: FormItem[]) {
  const subtotal = items.reduce((total, item) => total + item.unitPrice, 0)
  const surcharges = items.reduce((total, item) => total + surchargeFor(item), 0)
  const discounts = items.reduce((total, item) => total + discountFor(item), 0)
  return {
    subtotal,
    surcharges,
    discounts,
    grandTotal: Math.max(0, subtotal + surcharges - discounts),
  }
}

function money(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character)
}

function defaultItem(garment: string, fit: string): FormItem {
  return {
    garment,
    fit,
    color: "Azul marino",
    size: "",
    name: "",
    number: "",
    notes: "",
    unitPrice: 0,
    priceManuallyEdited: false,
    adjustment: {
      type: "surcharge",
      mode: "fixed",
      value: 0,
      note: "",
      enabled: false,
    },
  }
}

function createOrderId() {
  return `FS-${Date.now()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}

function today() {
  const date = new Date()
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

export function OrderWizard({ salespersonNames }: { salespersonNames: string[] }) {
  const [step, setStep] = useState(0)
  const [savedOrder, setSavedOrder] = useState<DemoOrder | null>(null)
  const [isCustomSalesperson, setIsCustomSalesperson] = useState(false)
  const [bulkGarment, setBulkGarment] = useState("Camiseta")
  const [bulkFit, setBulkFit] = useState("Hombre")
  const [bulkPrice, setBulkPrice] = useState("")
  const { companyId } = useOrdersOperator()
  const { inventory, error: inventoryError } = useDemoInventory()
  const { refresh: refreshOrders } = useDemoOrders()
  const garmentTypes = [...new Set([
    ...defaultGarmentTypes,
    ...(inventory?.products.map((product) => product.name) ?? []),
  ])]
  const availableColors = [...new Set([
    ...defaultColors,
    ...(inventory?.products.flatMap((product) => product.variants.map((variant) => variant.color)) ?? []),
  ])]
  const availableSizes = [...new Set([
    ...defaultSizes,
    ...(inventory?.products.flatMap((product) => product.variants.map((variant) => variant.size)) ?? []),
  ])]
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer: "",
      note: "",
      entryDate: today(),
      dueDate: "",
      salesperson: "",
      garments: [{ type: "Camiseta", fit: "Hombre", quantity: 1 }],
      items: [defaultItem("Camiseta", "Hombre")],
      paymentStatus: "Pendiente",
      paid: 0,
      paymentMethod: "",
    },
  })
  const garments = useFieldArray({ control: form.control, name: "garments" })
  const items = useFieldArray({ control: form.control, name: "items" })
  const watchedGarments = useWatch({ control: form.control, name: "garments" })
  const watchedItems = useWatch({ control: form.control, name: "items" })
  const watchedEntryDate = useWatch({ control: form.control, name: "entryDate" })
  const watchedPaymentStatus = useWatch({ control: form.control, name: "paymentStatus" })
  const watchedPaymentMethod = useWatch({ control: form.control, name: "paymentMethod" })
  const watchedPaid = useWatch({ control: form.control, name: "paid" })
  const variantOptions = watchedItems.map((item) => {
    const product = inventory?.products.find((candidate) => candidate.name === item?.garment)
    return {
      colors: product ? [...new Set(product.variants.map((variant) => variant.color))] : availableColors,
      sizes: product ? [...new Set(product.variants.map((variant) => variant.size))] : availableSizes,
    }
  })
  const totals = calculateTotals(watchedItems)
  const balance = Math.max(0, totals.grandTotal - (watchedPaid || 0))

  useEffect(() => {
    if (inventoryError) toast.error(inventoryError)
  }, [inventoryError])

  async function advance() {
    if (step === 2 && form.getValues("paymentStatus") === "Pagado") {
      form.setValue("paid", totals.grandTotal, { shouldDirty: true })
    }
    const fields = step === 0
      ? ["customer", "note", "entryDate", "dueDate", "salesperson"] as const
      : step === 1
        ? ["garments", "items"] as const
        : ["items", "paid", "paymentStatus", "paymentMethod"] as const
    const valid = await form.trigger(fields)
    if (!valid) return

    if (step === 1) {
      const expectedByCategory = new Map<string, number>()
      for (const garment of form.getValues("garments")) {
        expectedByCategory.set(
          `${garment.type}:${garment.fit}`,
          (expectedByCategory.get(`${garment.type}:${garment.fit}`) ?? 0) + garment.quantity,
        )
      }
      const actualByCategory = new Map<string, number>()
      for (const item of form.getValues("items")) {
        actualByCategory.set(
          `${item.garment}:${item.fit}`,
          (actualByCategory.get(`${item.garment}:${item.fit}`) ?? 0) + 1,
        )
      }
      const matrixMatches = expectedByCategory.size === actualByCategory.size
        && [...expectedByCategory].every(([category, count]) => actualByCategory.get(category) === count)
      if (!matrixMatches) {
        toast.error("Sincroniza la matriz para que tenga una fila por cada prenda.")
        return
      }
    }

    setStep((current) => Math.min(current + 1, steps.length - 1))
  }

  function removeCustomizationRow(index: number) {
    const item = form.getValues(`items.${index}`)
    const garmentIndex = form.getValues("garments").findIndex(
      (garment) => garment.type === item.garment && garment.fit === item.fit,
    )
    const baseGarments = form.getValues("garments")

    if (garmentIndex >= 0 && baseGarments[garmentIndex].quantity > 1) {
      form.setValue(
        `garments.${garmentIndex}.quantity`,
        baseGarments[garmentIndex].quantity - 1,
        { shouldDirty: true },
      )
    } else if (garmentIndex >= 0 && baseGarments.length > 1) {
      garments.remove(garmentIndex)
    }

    items.remove(index)
  }

  function synchronizeMatrix() {
    const currentItems = form.getValues("items")
    const itemsByCategory = new Map<string, FormItem[]>()
    for (const item of currentItems) {
      const key = `${item.garment}:${item.fit}`
      itemsByCategory.set(key, [...(itemsByCategory.get(key) ?? []), item])
    }
    const synchronizedItems = form.getValues("garments").flatMap((garment) => {
      const key = `${garment.type}:${garment.fit}`
      const existing = itemsByCategory.get(key) ?? []
      return Array.from({ length: garment.quantity }, (_, index) =>
        existing[index] ?? defaultItem(garment.type, garment.fit),
      )
    })
    items.replace(synchronizedItems)
    toast.success(`Matriz sincronizada: ${synchronizedItems.length} filas.`)
  }

  function applyBulkPrice() {
    const parsedPrice = Number(bulkPrice)
    if (!bulkPrice.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error("Ingresa un precio base válido, igual o mayor a cero.")
      return
    }

    let updated = 0
    form.getValues("items").forEach((item, index) => {
      if (item.garment !== bulkGarment || item.fit !== bulkFit || item.priceManuallyEdited) return
      form.setValue(`items.${index}.unitPrice`, parsedPrice, {
        shouldDirty: true,
        shouldValidate: true,
      })
      updated += 1
    })
    toast.success(updated
      ? `Precio aplicado a ${updated} prendas sin precio editado manualmente.`
      : "No hay prendas elegibles: revisa la categoría o las ediciones individuales.")
  }

  function updatePaymentStatus(status: OrderFormValues["paymentStatus"]) {
    form.setValue("paymentStatus", status, { shouldDirty: true, shouldValidate: true })
    if (status === "Pendiente") {
      form.setValue("paid", 0, { shouldDirty: true, shouldValidate: true })
      form.setValue("paymentMethod", "", { shouldDirty: true })
    } else if (status === "Pagado") {
      form.setValue("paid", totals.grandTotal, { shouldDirty: true, shouldValidate: true })
    } else if ((form.getValues("paid") || 0) >= totals.grandTotal) {
      form.setValue("paid", 0, { shouldDirty: true, shouldValidate: true })
    }
  }

  async function submitOrder(values: OrderFormValues) {
    try {
      if (savedOrder) {
        toast.info(`El pedido ${savedOrder.id} ya está guardado.`)
        return
      }

      const totalQuantity = values.garments.reduce((total, garment) => total + garment.quantity, 0)
      if (values.items.length !== totalQuantity) {
        toast.error(`La matriz tiene ${values.items.length} filas y el pedido ${totalQuantity} prendas. Ajusta las cantidades para que coincidan.`)
        return
      }

      const quantity = values.garments.reduce((total, garment) => total + garment.quantity, 0)
      const orderTotals = calculateTotals(values.items)
      const order: DemoOrder = {
        id: createOrderId(),
        companyId,
        entryDate: values.entryDate,
        customer: values.customer,
        item: values.garments[0]?.type ?? "Prenda personalizada",
        quantity,
        dueDate: values.dueDate,
        status: "Diseño",
        stage: "diseno",
        progress: 0,
        total: orderTotals.grandTotal,
        paid: values.paid,
        salesperson: values.salesperson,
        note: values.note,
        items: values.items.map((item) => ({
          garment: item.garment,
          fit: item.fit,
          color: item.color,
          size: item.size,
          name: item.name,
          number: item.number,
          notes: item.notes,
          unitPrice: item.unitPrice,
          priceManuallyEdited: item.priceManuallyEdited,
          adjustment: item.adjustment,
          netPrice: Math.max(0, item.unitPrice + surchargeFor(item) - discountFor(item)),
        })),
        paymentMethod: values.paymentMethod || null,
        paymentStatus: values.paymentStatus,
        timeline: [{
          date: new Intl.DateTimeFormat("es-CO", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date()),
          title: "Pedido registrado",
          operator: values.salesperson,
        }],
      }
      if (!inventory) throw new Error("El inventario todavía se está cargando. Inténtalo de nuevo.")
      await createSupabaseOrder(companyId, order, inventory)
      await refreshOrders()
      setSavedOrder(order)
      toast.success(`Pedido ${order.id} guardado. Ya puedes compartir la cotización.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el pedido.")
    }
  }

  async function shareQuote() {
    if (!savedOrder) return

    const quoteLines = savedOrder.items.map((item) => {
      const adjustment = item.adjustment?.enabled
        ? ` · ${item.adjustment.type === "surcharge" ? "Sobrecosto" : "Descuento"} ${item.adjustment.note || ""}: ${money(
          item.adjustment.mode === "percent"
            ? (item.adjustment.type === "surcharge"
              ? (item.unitPrice ?? 0) * item.adjustment.value / 100
              : (item.unitPrice ?? 0) * item.adjustment.value / 100)
            : item.adjustment.value,
        )}`
        : ""
      return `• ${item.garment} ${item.fit}, ${item.color}, talla ${item.size}${item.name ? ` · ${item.name}` : ""}${item.number ? ` · N.º ${item.number}` : ""}: ${money(item.netPrice ?? item.unitPrice ?? 0)}${adjustment}`
    })
    const quoteText = [
      `Cotización ${savedOrder.id}`,
      `Cliente: ${savedOrder.customer}`,
      `Entrega pactada: ${savedOrder.dueDate}`,
      "",
      ...quoteLines,
      "",
      `Total: ${money(savedOrder.total)}`,
      `Abono: ${money(savedOrder.paid)}`,
      `Saldo pendiente: ${money(Math.max(savedOrder.total - savedOrder.paid, 0))}`,
    ].join("\n")

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Cotización ${savedOrder.id}`,
          text: quoteText,
        })
        toast.success("Cotización compartida.")
        return
      }

      await navigator.clipboard.writeText(quoteText)
      toast.success("Cotización copiada. Ya puedes pegarla en un mensaje al cliente.")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast.error("No se pudo compartir la cotización. Intenta copiarla desde un navegador con permisos.")
    }
  }

  function downloadReceipt() {
    if (!savedOrder) return

    const rows = savedOrder.items.map((item, index) => {
      const description = [
        item.garment,
        item.fit,
        item.color,
        `Talla ${item.size}`,
        item.name,
        item.number ? `N.º ${item.number}` : "",
      ].filter((value): value is string => Boolean(value)).map(escapeHtml).join(" · ")
      const unitPrice = item.netPrice ?? item.unitPrice ?? 0

      return `<tr><td>${index + 1}</td><td>${description}</td><td class="number">${money(unitPrice)}</td></tr>`
    }).join("")
    const receipt = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Desprendible ${escapeHtml(savedOrder.id)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { color: #172033; font: 14px/1.5 Arial, sans-serif; margin: 0 auto; max-width: 760px; }
    header { border-bottom: 2px solid #172033; margin-bottom: 24px; padding-bottom: 16px; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 28px 0 10px; }
    .muted { color: #596579; }
    .details { display: grid; gap: 8px 24px; grid-template-columns: 1fr 1fr; }
    .details p { margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #d9dee8; padding: 10px 8px; text-align: left; }
    th { background: #f3f5f8; }
    .number { text-align: right; white-space: nowrap; }
    .totals { margin: 18px 0 0 auto; max-width: 320px; }
    .totals p { display: flex; justify-content: space-between; margin: 8px 0; }
    .grand-total { border-top: 2px solid #172033; font-size: 18px; font-weight: 700; padding-top: 10px; }
    footer { border-top: 1px solid #d9dee8; margin-top: 40px; padding-top: 12px; }
    .print-button { background: #172033; border: 0; border-radius: 6px; color: white; cursor: pointer; font-size: 14px; margin: 20px 0; padding: 12px 18px; }
    @media print { .print-button { display: none; } }
  </style>
</head>
<body>
  <button class="print-button" id="print-receipt">Descargar o imprimir como PDF</button>
  <header>
    <h1>Desprendible de pedido</h1>
    <div class="muted">Pedido ${escapeHtml(savedOrder.id)} · ${escapeHtml(new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date()))}</div>
  </header>
  <section class="details">
    <p><strong>Cliente:</strong> ${escapeHtml(savedOrder.customer)}</p>
    <p><strong>Vendedor:</strong> ${escapeHtml(savedOrder.salesperson)}</p>
    <p><strong>Entrega pactada:</strong> ${escapeHtml(savedOrder.dueDate)}</p>
    <p><strong>Estado del pago:</strong> ${escapeHtml(savedOrder.paymentStatus ?? "Pendiente")}</p>
    <p><strong>Medio de pago:</strong> ${escapeHtml(savedOrder.paymentMethod ?? "No registrado")}</p>
    <p><strong>Cantidad:</strong> ${savedOrder.quantity} prendas</p>
  </section>
  <h2>Detalle del pedido</h2>
  <table>
    <thead><tr><th>#</th><th>Prenda</th><th class="number">Valor unitario</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <section class="totals">
    <p><span>Total</span><strong>${money(savedOrder.total)}</strong></p>
    <p><span>Abono recibido</span><span>${money(savedOrder.paid)}</span></p>
    <p class="grand-total"><span>Saldo pendiente</span><span>${money(Math.max(savedOrder.total - savedOrder.paid, 0))}</span></p>
  </section>
  <footer class="muted">Este desprendible corresponde al pedido ${escapeHtml(savedOrder.id)}.</footer>
</body>
</html>`

    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast.error("El navegador bloqueó la ventana del desprendible. Permite ventanas emergentes e inténtalo de nuevo.")
      return
    }

    printWindow.document.open()
    printWindow.document.write(receipt)
    printWindow.document.close()
    printWindow.document.getElementById("print-receipt")?.addEventListener("click", () => {
      printWindow.print()
    })
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 250)
  }

  function handleWizardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step < steps.length - 1) {
      void advance()
    }
  }

  const totalGarments = watchedGarments.reduce(
    (total, garment) => total + (Number.isFinite(garment.quantity) ? garment.quantity : 0),
    0,
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="space-y-1">
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/dashboard/orders">
          <span className="inline-flex items-center gap-1"><ArrowLeftIcon className="size-3.5" /> Volver a pedidos</span>
        </Link>
        <h1 className="pt-2 text-2xl font-semibold tracking-tight">Crear pedido</h1>
        <p className="text-sm text-muted-foreground">
          Completa lo necesario en cada paso. Podrás revisar todo antes de guardarlo.
        </p>
      </div>

      <div aria-label="Progreso del pedido" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {steps.map((item, index) => (
          <div className="space-y-2" key={item.title}>
            <div className={`h-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} />
            <div className="flex items-center gap-2">
              <Badge variant={index === step ? "default" : "secondary"}>{index + 1}</Badge>
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${index > step ? "text-muted-foreground" : ""}`}>
                  {item.title}
                </p>
                <p className="hidden text-xs text-muted-foreground sm:block">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Form {...form}>
        <form className="space-y-5" noValidate onSubmit={handleWizardSubmit}>
          {step === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Datos generales</CardTitle>
                <CardDescription>La información base para dar inicio al pedido.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium sm:col-span-2">
                  Cliente
                  <Input autoComplete="organization" placeholder="Nombre del cliente o equipo" {...form.register("customer")} />
                  <FieldError errors={[form.formState.errors.customer]} />
                </label>
                <label className="space-y-2 text-sm font-medium sm:col-span-2">
                  Nota del pedido
                  <Input maxLength={1000} placeholder="Indicaciones generales o detalles importantes" {...form.register("note")} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Fecha de ingreso
                  <Input type="date" {...form.register("entryDate")} />
                  <FieldError errors={[form.formState.errors.entryDate]} />
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Fecha de entrega pactada
                  <Input min={watchedEntryDate} type="date" {...form.register("dueDate")} />
                  <FieldError errors={[form.formState.errors.dueDate]} />
                </label>
                <div className="space-y-2 text-sm font-medium">
                  <label htmlFor="salesperson">Vendedor responsable</label>
                  <Controller
                    control={form.control}
                    name="salesperson"
                    render={({ field }) => (
                      <div className="space-y-2">
                        <Select
                          value={isCustomSalesperson ? customSalespersonValue : field.value || null}
                          onValueChange={(value) => {
                            if (value === customSalespersonValue) {
                              setIsCustomSalesperson(true)
                              field.onChange("")
                            } else if (value) {
                              setIsCustomSalesperson(false)
                              field.onChange(value)
                            }
                          }}
                        >
                          <SelectTrigger className="w-full" id="salesperson">
                            <SelectValue placeholder="Selecciona un vendedor" />
                          </SelectTrigger>
                          <SelectContent>
                            {salespersonNames.map((name) => (
                              <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                            <SelectItem value={customSalespersonValue}>Nombre personalizado</SelectItem>
                          </SelectContent>
                        </Select>
                        {isCustomSalesperson && (
                          <Input
                            autoComplete="name"
                            aria-label="Nombre personalizado del vendedor"
                            maxLength={100}
                            onChange={(event) => field.onChange(event.target.value)}
                            placeholder="Escribe el nombre del vendedor"
                            value={field.value}
                          />
                        )}
                      </div>
                    )}
                  />
                  <FieldError errors={[form.formState.errors.salesperson]} />
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Resumen de prendas base</CardTitle>
                    <CardDescription>Define los tipos, hormas y cantidades del pedido.</CardDescription>
                  </div>
                  <Badge variant="secondary">{totalGarments} prendas</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prenda</TableHead>
                      <TableHead>Horma</TableHead>
                      <TableHead className="w-32">Cantidad</TableHead>
                      <TableHead><span className="sr-only">Quitar</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {garments.fields.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`garments.${index}.type`}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                                <SelectTrigger aria-label={`Prenda ${index + 1}`} className="w-full min-w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {garmentTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            control={form.control}
                            name={`garments.${index}.fit`}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                                <SelectTrigger aria-label={`Horma ${index + 1}`} className="w-full min-w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {fits.map((fit) => <SelectItem key={fit} value={fit}>{fit}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            aria-label={`Cantidad de prendas ${index + 1}`}
                            className="w-28"
                            min={1}
                            type="number"
                            {...form.register(`garments.${index}.quantity`, { valueAsNumber: true })}
                          />
                          <FieldError errors={[form.formState.errors.garments?.[index]?.quantity]} />
                        </TableCell>
                        <TableCell>
                          <Button
                            aria-label={`Quitar tipo de prenda ${index + 1}`}
                            disabled={garments.fields.length === 1}
                            onClick={() => garments.remove(index)}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2Icon />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <FieldError errors={form.formState.errors.garments?.root ? [form.formState.errors.garments.root] : []} />
                <Button
                  onClick={() => garments.append({ type: "Camiseta", fit: "Hombre", quantity: 1 })}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <PlusIcon data-icon="inline-start" /> Añadir tipo de prenda
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Matriz de personalización</CardTitle>
                    <CardDescription>
                      Una fila por prenda. Ajusta las cantidades base y sincroniza la matriz para conservar el detalle ingresado.
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{items.fields.length} filas</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prenda / horma</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Talla</TableHead>
                        <TableHead>Nombre / apodo</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Observaciones</TableHead>
                        <TableHead><span className="sr-only">Quitar</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.fields.map((row, index) => (
                        <TableRow key={row.id}>
                          <TableCell className="min-w-36 text-xs">
                            <p className="font-medium">{watchedItems[index]?.garment}</p>
                            <p className="text-muted-foreground">{watchedItems[index]?.fit}</p>
                          </TableCell>
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`items.${index}.color`}
                              render={({ field }) => (
                                <div className="space-y-1">
                                  <Select value={field.value || null} onValueChange={(value) => field.onChange(value ?? "")}>
                                    <SelectTrigger aria-label={`Color de fila ${index + 1}`} className="w-32">
                                      <SelectValue placeholder="Color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(variantOptions[index]?.colors ?? availableColors).map((color) => <SelectItem key={color} value={color}>{color}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <FieldError errors={[form.formState.errors.items?.[index]?.color]} />
                                </div>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Controller
                              control={form.control}
                              name={`items.${index}.size`}
                              render={({ field }) => (
                                <div className="space-y-1">
                                  <Select value={field.value || null} onValueChange={(value) => field.onChange(value ?? "")}>
                                    <SelectTrigger aria-label={`Talla de fila ${index + 1}`} className="w-24">
                                      <SelectValue placeholder="Talla" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(variantOptions[index]?.sizes ?? availableSizes).map((size) => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <FieldError errors={[form.formState.errors.items?.[index]?.size]} />
                                </div>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <Input aria-label={`Nombre o apodo de fila ${index + 1}`} placeholder="Opcional" {...form.register(`items.${index}.name`)} />
                          </TableCell>
                          <TableCell>
                            <Input aria-label={`Número de fila ${index + 1}`} className="w-20" placeholder="—" {...form.register(`items.${index}.number`)} />
                          </TableCell>
                          <TableCell>
                            <Input aria-label={`Observaciones de fila ${index + 1}`} placeholder="Opcional" {...form.register(`items.${index}.notes`)} />
                          </TableCell>
                          <TableCell>
                            <Button
                              aria-label={`Quitar fila ${index + 1}`}
                              disabled={items.fields.length === 1 && totalGarments === 1}
                              onClick={() => removeCustomizationRow(index)}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              <Trash2Icon />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={synchronizeMatrix} size="sm" type="button" variant="outline">
                    Sincronizar filas con cantidades
                  </Button>
                </div>
                {form.formState.errors.items?.message && (
                  <FieldError>{form.formState.errors.items.message}</FieldError>
                )}
              </CardContent>
            </Card>
            </>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Asignación rápida de precios</CardTitle>
                      <CardDescription>
                        Aplica un precio base a una categoría; los importes editados a mano no se reemplazan.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{items.fields.length} prendas</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
                  <label className="space-y-2 text-sm font-medium">
                    Tipo de prenda
                    <Select value={bulkGarment} onValueChange={(value) => value && setBulkGarment(value)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[...new Set(watchedGarments.map((garment) => garment.type))].map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Horma
                    <Select value={bulkFit} onValueChange={(value) => value && setBulkFit(value)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fits.map((fit) => <SelectItem key={fit} value={fit}>{fit}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Precio base por unidad
                    <Input
                      min={0}
                      onChange={(event) => setBulkPrice(event.target.value)}
                      placeholder="Ej. 45.000"
                      type="number"
                      value={bulkPrice}
                    />
                  </label>
                  <Button className="w-full lg:w-auto" onClick={applyBulkPrice} type="button">
                    Aplicar a todos
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Desglose individual</CardTitle>
                  <CardDescription>
                    Define el valor de cada prenda. Sobrecostos y descuentos permanecen dentro de los ajustes de cada fila.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prenda personalizada</TableHead>
                          <TableHead className="min-w-40">Precio unitario</TableHead>
                          <TableHead>Ajustes</TableHead>
                          <TableHead className="text-right">Neto por prenda</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.fields.map((row, index) => {
                          const currentItem = watchedItems[index] ?? defaultItem("", "")
                          const surcharge = surchargeFor(currentItem)
                          const discount = discountFor(currentItem)
                          const netPrice = Math.max(0, currentItem.unitPrice + surcharge - discount)
                          return (
                            <TableRow key={row.id}>
                              <TableCell className="min-w-48">
                                <p className="font-medium">
                                  {currentItem.garment} · {currentItem.size || "Sin talla"}
                                </p>
                                <p className="max-w-48 truncate text-xs text-muted-foreground">
                                  {[currentItem.fit, currentItem.name, currentItem.number && `N.º ${currentItem.number}`]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <Input
                                    aria-label={`Precio unitario de ${currentItem.garment}, talla ${currentItem.size}`}
                                    className="w-36"
                                    min={0}
                                    placeholder="Ej. 45.000"
                                    type="number"
                                    {...form.register(`items.${index}.unitPrice`, {
                                      setValueAs: (value: string) => value === "" ? 0 : Number(value),
                                      onChange: () => form.setValue(
                                        `items.${index}.priceManuallyEdited`,
                                        true,
                                        { shouldDirty: true },
                                      ),
                                    })}
                                    value={currentItem.unitPrice || ""}
                                  />
                                  {currentItem.priceManuallyEdited && (
                                    <Badge variant="outline" className="text-[10px]">Editado manualmente</Badge>
                                  )}
                                  <FieldError errors={[form.formState.errors.items?.[index]?.unitPrice]} />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Popover>
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <PopoverTrigger
                                          aria-label={`Ajustes de precio para prenda ${index + 1}`}
                                          render={<Button size="icon-sm" type="button" variant="ghost" />}
                                        />
                                      }
                                    >
                                      <Settings2Icon />
                                    </TooltipTrigger>
                                    <TooltipContent>Ajustar sobrecosto o descuento</TooltipContent>
                                  </Tooltip>
                                  <PopoverContent align="start" className="w-[min(88vw,340px)] space-y-4">
                                    <div>
                                      <p className="text-sm font-semibold">Ajuste por prenda</p>
                                      <p className="text-xs text-muted-foreground">
                                        {currentItem.garment} · {currentItem.size || "Sin talla"}
                                      </p>
                                    </div>
                                    <Controller
                                      control={form.control}
                                      name={`items.${index}.adjustment.enabled`}
                                      render={({ field }) => (
                                        <label className="flex items-center justify-between gap-3 text-sm">
                                          Incluir ajuste
                                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </label>
                                      )}
                                    />
                                    {currentItem.adjustment.enabled && (
                                      <>
                                        <div className="grid grid-cols-2 gap-3">
                                          <label className="space-y-1.5 text-xs font-medium">
                                            Tipo
                                            <Select
                                              value={currentItem.adjustment.type}
                                              onValueChange={(value) => {
                                                if (value === "surcharge" || value === "discount") {
                                                  form.setValue(`items.${index}.adjustment.type`, value, {
                                                    shouldDirty: true,
                                                  })
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="w-full">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="surcharge">Sobrecosto</SelectItem>
                                                <SelectItem value="discount">Descuento</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </label>
                                          <label className="space-y-1.5 text-xs font-medium">
                                            Descripción
                                            <Input
                                              placeholder="Ej. Manga larga"
                                              {...form.register(`items.${index}.adjustment.note`)}
                                            />
                                          </label>
                                        </div>
                                        <div className="space-y-2">
                                          <span className="text-xs font-medium">Forma del ajuste</span>
                                          <Controller
                                            control={form.control}
                                            name={`items.${index}.adjustment.mode`}
                                            render={({ field }) => (
                                              <RadioGroup
                                                className="flex gap-4"
                                                onValueChange={field.onChange}
                                                value={field.value}
                                              >
                                                <label className="flex items-center gap-2 text-sm">
                                                  <RadioGroupItem value="fixed" />
                                                  Monto fijo
                                                </label>
                                                <label className="flex items-center gap-2 text-sm">
                                                  <RadioGroupItem value="percent" />
                                                  Porcentaje
                                                </label>
                                              </RadioGroup>
                                            )}
                                          />
                                        </div>
                                        <label className="space-y-1.5 text-xs font-medium">
                                          {currentItem.adjustment.type === "surcharge" ? "Valor del sobrecosto" : "Valor del descuento"}
                                          <Input
                                            min={0}
                                            max={currentItem.adjustment.mode === "percent" ? 100 : undefined}
                                            step={currentItem.adjustment.mode === "percent" ? 0.1 : 1}
                                            type="number"
                                            {...form.register(`items.${index}.adjustment.value`, {
                                              setValueAs: (value: string) => value === "" ? 0 : Number(value),
                                            })}
                                          />
                                          <FieldError errors={[form.formState.errors.items?.[index]?.adjustment?.value]} />
                                        </label>
                                        <p className="text-xs text-muted-foreground">
                                          {currentItem.adjustment.type === "surcharge" ? "Sobrecosto" : "Descuento"} aplicado:{" "}
                                          {money(currentItem.adjustment.type === "surcharge" ? surcharge : discount)}
                                        </p>
                                      </>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">{money(netPrice)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {form.formState.errors.items?.message && (
                    <FieldError>{form.formState.errors.items.message}</FieldError>
                  )}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Total neto de prendas</span>
                    <span className="font-semibold tabular-nums">{money(totals.grandTotal)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen financiero</CardTitle>
                  <CardDescription>El total se recalcula al instante con los precios y ajustes por prenda.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Subtotal prendas</span>
                    <span className="tabular-nums">{money(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Sobrecostos</span>
                    <span className="tabular-nums">{money(totals.surcharges)}</span>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Descuentos</span>
                    <span className="tabular-nums">−{money(totals.discounts)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">Gran total</p>
                      <p className="text-xs text-muted-foreground">{items.fields.length} prendas</p>
                    </div>
                    <p className="text-xl font-semibold tabular-nums">{money(totals.grandTotal)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pago inicial</CardTitle>
                  <CardDescription>Registra el abono recibido o deja el pago pendiente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="space-y-2 text-sm font-medium">
                    Estado del pago
                    <Select
                      value={watchedPaymentStatus}
                      onValueChange={(value) => {
                        if (value === "Pendiente" || value === "Abonado" || value === "Pagado") {
                          updatePaymentStatus(value)
                        }
                      }}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Pendiente", "Abonado", "Pagado"].map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Monto abonado
                    <Input
                      disabled={watchedPaymentStatus === "Pendiente" || watchedPaymentStatus === "Pagado"}
                      max={totals.grandTotal}
                      min={0}
                      placeholder="Ej. 100.000"
                      type="number"
                      {...form.register("paid", {
                        setValueAs: (value: string) => value === "" ? 0 : Number(value),
                      })}
                      value={watchedPaid || ""}
                    />
                    <FieldError errors={[form.formState.errors.paid]} />
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Método de pago
                    <Select
                      value={watchedPaymentMethod || null}
                      onValueChange={(value) => form.setValue("paymentMethod", value ?? "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecciona un método" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[form.formState.errors.paymentMethod]} />
                  </label>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Saldo pendiente</span>
                    <Badge variant={balance === 0 ? "secondary" : "outline"}>{money(balance)}</Badge>
                  </div>
                  {!savedOrder && (
                    <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      El pedido aún no se ha guardado. Revisa los datos y confírmalo con el botón inferior.
                    </p>
                  )}
                  {savedOrder && (
                    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                      <div>
                        <p className="font-medium">Pedido {savedOrder.id} guardado</p>
                        <p className="text-sm opacity-80">
                          El desprendible está listo para descargar o compartir con el cliente.
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button className="w-full" onClick={downloadReceipt} type="button">
                          Descargar desprendible PDF
                        </Button>
                        <Button className="w-full" onClick={() => void shareQuote()} type="button" variant="outline">
                          Compartir cotización
                        </Button>
                      </div>
                      <p className="text-xs opacity-80">
                        Al descargar, elige «Guardar como PDF» en la ventana de impresión.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          className="w-full"
                          render={<Link href="/dashboard/orders" />}
                          variant="outline"
                        >
                          <ListIcon data-icon="inline-start" /> Ir a pedidos
                        </Button>
                        <Button
                          className="w-full"
                          render={<Link href="/dashboard" />}
                          variant="outline"
                        >
                          <HouseIcon data-icon="inline-start" /> Ir al inicio
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              disabled={step === 0 || form.formState.isSubmitting}
              onClick={() => setStep((current) => Math.max(current - 1, 0))}
              type="button"
              variant="outline"
            >
              <ArrowLeftIcon data-icon="inline-start" /> Anterior
            </Button>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Paso {step + 1} de {steps.length}
            </p>
            {step < steps.length - 1 ? (
              <Button disabled={form.formState.isSubmitting} onClick={() => void advance()} type="button">
                Continuar <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                disabled={form.formState.isSubmitting || Boolean(savedOrder)}
                onClick={() => void form.handleSubmit(submitOrder)()}
                type="button"
              >
                {form.formState.isSubmitting
                  ? "Guardando…"
                  : savedOrder
                    ? <><CheckIcon data-icon="inline-start" /> Pedido guardado</>
                    : <><CheckIcon data-icon="inline-start" /> Confirmar y guardar pedido</>}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  )
}
