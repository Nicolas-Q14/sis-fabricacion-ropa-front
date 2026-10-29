"use client"

import type { ChangeEvent, FormEvent } from "react"
import { useEffect, useRef, useState } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  CheckIcon,
  FileTextIcon,
  HouseIcon,
  ImagePlusIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  Trash2Icon,
  XIcon,
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
import {
  createSupabaseQuotation,
  type QuotationImage,
  type QuotationItem,
} from "@/lib/orders/supabase-quotations"
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

const quotationFormSchema = z.object({
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
}).refine((values) => values.dueDate >= values.entryDate, {
  message: "La fecha de entrega debe ser igual o posterior al ingreso.",
  path: ["dueDate"],
}).superRefine((values, context) => {
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
})

type OrderFormValues = z.infer<typeof orderSchema>
type SavedQuotation = {
  id: string
  quoteNumber: string
  customer: string
  salesperson: string
  note: string
  entryDate: string
  dueDate: string
  quantity: number
  total: number
  items: QuotationItem[]
  images: QuotationImage[]
}

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
const allowedReferenceImageTypes = ["image/jpeg", "image/png", "image/webp"]
const maxReferenceImageSize = 5 * 1024 * 1024
const maxReferenceImageCount = 10
const garmentGroupColors = [
  "border-l-emerald-500",
  "border-l-orange-500",
  "border-l-blue-500",
  "border-l-violet-500",
  "border-l-rose-500",
  "border-l-cyan-500",
  "border-l-amber-500",
  "border-l-pink-500",
]

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
  const [savedQuotation, setSavedQuotation] = useState<SavedQuotation | null>(null)
  const [referenceImages, setReferenceImages] = useState<File[]>([])
  const [isSavingQuotation, setIsSavingQuotation] = useState(false)
  const referenceImageInput = useRef<HTMLInputElement>(null)
  const [isCustomSalesperson, setIsCustomSalesperson] = useState(false)
  const [openGarmentTypeIndex, setOpenGarmentTypeIndex] = useState<number | null>(null)
  const [garmentTypeSearch, setGarmentTypeSearch] = useState("")
  const [sizeBatchGarmentPickerOpen, setSizeBatchGarmentPickerOpen] = useState(false)
  const [sizeBatchGarmentSearch, setSizeBatchGarmentSearch] = useState("")
  const [bulkGarment, setBulkGarment] = useState("")
  const [bulkFit, setBulkFit] = useState("")
  const [bulkPrice, setBulkPrice] = useState("")
  const [sizeBatchGarment, setSizeBatchGarment] = useState("Camiseta")
  const [sizeBatchFit, setSizeBatchFit] = useState("Hombre")
  const [sizeBatchColor, setSizeBatchColor] = useState(defaultColors[0])
  const [sizeBatchSize, setSizeBatchSize] = useState("")
  const [sizeBatchQuantity, setSizeBatchQuantity] = useState("1")
  const { companyId } = useOrdersOperator()
  const { inventory, error: inventoryError } = useDemoInventory()
  const { refresh: refreshOrders } = useDemoOrders()
  const garmentTypes = [...new Set([
    ...defaultGarmentTypes,
    ...(inventory?.products.map((product) => product.name) ?? []),
  ])]
  const visibleGarmentTypes = garmentTypeSearch.trim()
    ? garmentTypes.filter((type) =>
        type.toLocaleLowerCase("es").includes(garmentTypeSearch.trim().toLocaleLowerCase("es")),
      )
    : defaultGarmentTypes
  const visibleSizeBatchGarmentTypes = sizeBatchGarmentSearch.trim()
    ? garmentTypes.filter((type) =>
        type.toLocaleLowerCase("es").includes(sizeBatchGarmentSearch.trim().toLocaleLowerCase("es")),
      )
    : defaultGarmentTypes
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
  const bulkGarmentOptions = [...new Set(watchedGarments.map((garment) => garment.type))]
  const selectedBulkGarment = bulkGarmentOptions.includes(bulkGarment)
    ? bulkGarment
    : bulkGarmentOptions[0] ?? ""
  const bulkFitOptions = [...new Set(
    watchedGarments
      .filter((garment) => garment.type === selectedBulkGarment)
      .map((garment) => garment.fit),
  )]
  const selectedBulkFit = bulkFitOptions.includes(bulkFit)
    ? bulkFit
    : bulkFitOptions[0] ?? ""
  const garmentColors = new Map<string, string>()
  for (const item of watchedItems) {
    if (!garmentColors.has(item.garment)) {
      garmentColors.set(
        item.garment,
        garmentGroupColors[garmentColors.size % garmentGroupColors.length],
      )
    }
  }
  const variantOptions = watchedItems.map((item) => {
    const product = inventory?.products.find((candidate) => candidate.name === item?.garment)
    return {
      colors: product ? [...new Set(product.variants.map((variant) => variant.color))] : availableColors,
      sizes: product ? [...new Set(product.variants.map((variant) => variant.size))] : availableSizes,
    }
  })
  const sizeBatchProduct = inventory?.products.find((product) => product.name === sizeBatchGarment)
  const sizeBatchColors = sizeBatchProduct
    ? [...new Set(sizeBatchProduct.variants.map((variant) => variant.color))]
    : availableColors
  const sizeBatchSizes = sizeBatchProduct
    ? [...new Set(sizeBatchProduct.variants.map((variant) => variant.size))]
    : availableSizes
  const selectedSizeBatchColor = sizeBatchColors.includes(sizeBatchColor)
    ? sizeBatchColor
    : sizeBatchColors[0] ?? ""
  const selectedSizeBatchSize = sizeBatchSizes.includes(sizeBatchSize)
    ? sizeBatchSize
    : ""
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

  function addSizeBatch() {
    const quantity = Number(sizeBatchQuantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Ingresa una cantidad entera de prendas igual o mayor a uno.")
      return
    }
    if (!selectedSizeBatchColor || !selectedSizeBatchSize) {
      toast.error("Selecciona el color y la talla para cargar el lote.")
      return
    }

    const garmentsValues = form.getValues("garments")
    const garmentIndex = garmentsValues.findIndex(
      (garment) => garment.type === sizeBatchGarment && garment.fit === sizeBatchFit,
    )
    if (garmentIndex >= 0 && (
      !Number.isInteger(garmentsValues[garmentIndex].quantity)
      || garmentsValues[garmentIndex].quantity < 1
    )) {
      toast.error("Corrige la cantidad de prendas de esta combinación antes de cargar el lote.")
      return
    }

    const currentItems = form.getValues("items")
    const emptyRows = currentItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        item.garment === sizeBatchGarment
        && item.fit === sizeBatchFit
        && !item.size.trim(),
      )
    const filledRows = Math.min(quantity, emptyRows.length)

    for (const { index } of emptyRows.slice(0, filledRows)) {
      form.setValue(`items.${index}.color`, selectedSizeBatchColor, { shouldDirty: true })
      form.setValue(`items.${index}.size`, selectedSizeBatchSize, { shouldDirty: true })
    }

    const addedItems = Array.from(
      { length: quantity - filledRows },
      () => ({
        ...defaultItem(sizeBatchGarment, sizeBatchFit),
        color: selectedSizeBatchColor,
        size: selectedSizeBatchSize,
      }),
    )
    if (addedItems.length > 0) items.append(addedItems)

    if (garmentIndex >= 0) {
      form.setValue(
        `garments.${garmentIndex}.quantity`,
        garmentsValues[garmentIndex].quantity + addedItems.length,
        { shouldDirty: true, shouldValidate: true },
      )
    } else {
      garments.append({
        type: sizeBatchGarment,
        fit: sizeBatchFit,
        quantity,
      })
    }

    toast.success(`Lote cargado: ${quantity} prendas talla ${selectedSizeBatchSize}.`)
  }

  function applyBulkPrice() {
    const parsedPrice = Number(bulkPrice)
    if (!bulkPrice.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error("Ingresa un precio base válido, igual o mayor a cero.")
      return
    }

    let updated = 0
    form.getValues("items").forEach((item, index) => {
      if (item.garment !== selectedBulkGarment || item.fit !== selectedBulkFit || item.priceManuallyEdited) return
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

  function selectReferenceImages(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = [...(event.target.files ?? [])]
    event.target.value = ""
    if (referenceImages.length + selectedFiles.length > maxReferenceImageCount) {
      toast.error(`Puedes adjuntar hasta ${maxReferenceImageCount} imágenes por cotización.`)
      return
    }
    const invalidType = selectedFiles.find((file) => !allowedReferenceImageTypes.includes(file.type))
    if (invalidType) {
      toast.error("Las imágenes deben estar en formato JPG, PNG o WebP.")
      return
    }
    const oversizedImage = selectedFiles.find((file) => file.size > maxReferenceImageSize)
    if (oversizedImage) {
      toast.error("Cada imagen de referencia puede pesar hasta 5 MB.")
      return
    }
    setReferenceImages((current) => [...current, ...selectedFiles])
  }

  async function saveAsQuotation() {
    if (savedQuotation) {
      toast.info(`La cotización ${savedQuotation.quoteNumber} ya está guardada.`)
      return
    }

    const parsedValues = quotationFormSchema.safeParse(form.getValues())
    if (!parsedValues.success) {
      toast.error(parsedValues.error.issues[0]?.message ?? "Revisa los datos de la cotización.")
      return
    }

    const values = parsedValues.data
    const expectedByCategory = new Map<string, number>()
    for (const garment of values.garments) {
      const key = `${garment.type}:${garment.fit}`
      expectedByCategory.set(key, (expectedByCategory.get(key) ?? 0) + garment.quantity)
    }
    const actualByCategory = new Map<string, number>()
    for (const item of values.items) {
      const key = `${item.garment}:${item.fit}`
      actualByCategory.set(key, (actualByCategory.get(key) ?? 0) + 1)
    }
    const matrixMatches = expectedByCategory.size === actualByCategory.size
      && [...expectedByCategory].every(([category, count]) => actualByCategory.get(category) === count)
    if (!matrixMatches) {
      toast.error("Sincroniza la matriz para que tenga una fila por cada prenda.")
      return
    }

    const quantity = values.garments.reduce((total, garment) => total + garment.quantity, 0)
    const quotationTotals = calculateTotals(values.items)
    const quotationItems = values.items.map((item) => ({
      garment: item.garment,
      fit: item.fit,
      color: item.color,
      size: item.size,
      name: item.name,
      number: item.number,
      notes: item.notes,
      unitPrice: item.unitPrice,
      adjustment: item.adjustment,
      netPrice: Math.max(0, item.unitPrice + surchargeFor(item) - discountFor(item)),
    }))

    setIsSavingQuotation(true)
    try {
      const created = await createSupabaseQuotation(companyId, {
        customer_name: values.customer,
        salesperson: values.salesperson,
        note: values.note,
        entry_date: values.entryDate,
        delivery_date: values.dueDate,
        quantity,
        subtotal: quotationTotals.subtotal,
        surcharges: quotationTotals.surcharges,
        discounts: quotationTotals.discounts,
        grand_total: quotationTotals.grandTotal,
        items: quotationItems,
      }, referenceImages)
      setSavedQuotation({
        id: created.id,
        quoteNumber: created.quoteNumber,
        customer: values.customer,
        salesperson: values.salesperson,
        note: values.note,
        entryDate: values.entryDate,
        dueDate: values.dueDate,
        quantity,
        total: quotationTotals.grandTotal,
        items: quotationItems,
        images: created.images,
      })
      toast.success(`Cotización ${created.quoteNumber} guardada sin registrar un pedido.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la cotización.")
    } finally {
      setIsSavingQuotation(false)
    }
  }

  async function shareSavedQuotation() {
    if (!savedQuotation) return
    const text = [
      `Cotización ${savedQuotation.quoteNumber}`,
      `Cliente: ${savedQuotation.customer}`,
      `Entrega pactada: ${savedQuotation.dueDate}`,
      "",
      ...savedQuotation.items.map((item) =>
        `• ${item.garment} ${item.fit}, ${item.color}, talla ${item.size}${item.name ? ` · ${item.name}` : ""}${item.number ? ` · N.º ${item.number}` : ""}: ${money(item.netPrice)}`,
      ),
      "",
      `Total: ${money(savedQuotation.total)}`,
      ...savedQuotation.images.map((image, index) => `Imagen de referencia ${index + 1}: ${image.signedUrl}`),
    ].join("\n")

    try {
      if (navigator.share) {
        await navigator.share({ title: `Cotización ${savedQuotation.quoteNumber}`, text })
        toast.success("Cotización compartida.")
        return
      }

      await navigator.clipboard.writeText(text)
      toast.success("Cotización copiada con los enlaces de sus imágenes.")
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast.error("No se pudo compartir la cotización. Intenta copiarla desde un navegador con permisos.")
    }
  }

  function downloadSavedQuotation() {
    if (!savedQuotation) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast.error("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.")
      return
    }

    const rows = savedQuotation.items.map((item) => `
      <tr>
        <td>${escapeHtml(item.garment)} · ${escapeHtml(item.fit)} · ${escapeHtml(item.color)} · Talla ${escapeHtml(item.size)}${item.name ? `<br>Nombre: ${escapeHtml(item.name)}` : ""}${item.number ? `<br>Número: ${escapeHtml(item.number)}` : ""}</td>
        <td class="number">${escapeHtml(money(item.netPrice))}</td>
      </tr>`,
    ).join("")
    const images = savedQuotation.images.map((image, index) => `
      <figure>
        <img src="${escapeHtml(image.signedUrl)}" alt="Imagen de referencia ${index + 1}">
        <figcaption>Imagen de referencia ${index + 1}</figcaption>
      </figure>`,
    ).join("")

    printWindow.document.open()
    printWindow.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cotización ${escapeHtml(savedQuotation.quoteNumber)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { color: #172033; font: 14px/1.5 Arial, sans-serif; margin: 0 auto; max-width: 760px; }
    header { border-bottom: 2px solid #172033; margin-bottom: 24px; padding-bottom: 16px; }
    h1 { font-size: 24px; margin: 0 0 4px; }
    h2 { font-size: 16px; margin: 28px 0 10px; }
    .muted { color: #667085; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #d9dee8; padding: 9px 6px; text-align: left; vertical-align: top; }
    th { background: #f3f5f8; }
    .number { text-align: right; white-space: nowrap; }
    .total { border-top: 2px solid #172033; font-size: 18px; font-weight: 700; margin: 16px 0 0 auto; max-width: 300px; padding-top: 10px; text-align: right; }
    .references { display: grid; gap: 16px; grid-template-columns: repeat(2, 1fr); }
    figure { margin: 0; page-break-inside: avoid; }
    figure img { max-height: 320px; object-fit: contain; width: 100%; }
    figcaption { color: #667085; font-size: 12px; }
    .print-button { background: #172033; border: 0; border-radius: 6px; color: white; cursor: pointer; margin: 20px 0; padding: 12px 18px; }
    @media print { .print-button { display: none; } }
  </style>
</head>
<body>
  <button class="print-button" id="print-quotation">Descargar o imprimir como PDF</button>
  <header>
    <h1>Cotización ${escapeHtml(savedQuotation.quoteNumber)}</h1>
    <div class="muted">${escapeHtml(new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date()))}</div>
  </header>
  <section>
    <p><strong>Cliente:</strong> ${escapeHtml(savedQuotation.customer)}</p>
    <p><strong>Vendedor:</strong> ${escapeHtml(savedQuotation.salesperson)}</p>
    <p><strong>Fecha de ingreso:</strong> ${escapeHtml(savedQuotation.entryDate)}</p>
    <p><strong>Entrega pactada:</strong> ${escapeHtml(savedQuotation.dueDate)}</p>
    <p><strong>Cantidad:</strong> ${savedQuotation.quantity} prendas</p>
    ${savedQuotation.note ? `<p><strong>Nota:</strong> ${escapeHtml(savedQuotation.note)}</p>` : ""}
  </section>
  <h2>Detalle de prendas</h2>
  <table>
    <thead><tr><th>Prenda</th><th class="number">Valor por unidad</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="total">Total: ${escapeHtml(money(savedQuotation.total))}</p>
  ${images ? `<h2>Imágenes de referencia</h2><section class="references">${images}</section>` : ""}
  <p class="muted">Esta cotización no constituye un pedido confirmado.</p>
</body>
</html>`)
    printWindow.document.close()
    printWindow.document.getElementById("print-quotation")?.addEventListener("click", () => {
      printWindow.print()
    })
    let hasPrinted = false
    const printOnce = () => {
      if (hasPrinted) return
      hasPrinted = true
      printWindow.focus()
      printWindow.print()
    }
    const imagesLoaded = Promise.all(Array.from(printWindow.document.images).map((image) => {
      if (image.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true })
        image.addEventListener("error", () => resolve(), { once: true })
      })
    }))
    void imagesLoaded.then(() => window.setTimeout(printOnce, 100))
    window.setTimeout(printOnce, 5000)
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
                      <TableRow
                        className={
                          index > 0 && watchedGarments[index - 1]?.type !== watchedGarments[index]?.type
                            ? "border-t-4 border-t-background"
                            : undefined
                        }
                        key={row.id}
                      >
                        <TableCell>
                          <Popover
                            open={openGarmentTypeIndex === index}
                            onOpenChange={(open) => {
                              setOpenGarmentTypeIndex(open ? index : null)
                              if (open) setGarmentTypeSearch("")
                            }}
                          >
                            <PopoverTrigger
                              render={
                                <Button
                                  aria-expanded={openGarmentTypeIndex === index}
                                  aria-label={`Prenda ${index + 1}`}
                                  className="w-full min-w-36 justify-between"
                                  role="combobox"
                                  type="button"
                                  variant="outline"
                                />
                              }
                            >
                              <span className="truncate">
                                {watchedGarments[index]?.type || "Selecciona una prenda"}
                              </span>
                              <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-[min(88vw,320px)] p-2">
                              <div className="relative">
                                <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                  aria-label="Buscar tipo de prenda"
                                  autoFocus
                                  className="pl-8"
                                  onChange={(event) => setGarmentTypeSearch(event.target.value)}
                                  placeholder="Buscar entre todas las prendas…"
                                  value={garmentTypeSearch}
                                />
                              </div>
                              <div
                                aria-label="Tipos de prenda"
                                className="mt-2 max-h-56 overflow-y-auto"
                                role="listbox"
                              >
                                {visibleGarmentTypes.length > 0 ? visibleGarmentTypes.map((type) => {
                                  const selected = watchedGarments[index]?.type === type
                                  return (
                                    <Button
                                      aria-selected={selected}
                                      className="w-full justify-between"
                                      key={type}
                                      onClick={() => {
                                        form.setValue(`garments.${index}.type`, type, {
                                          shouldDirty: true,
                                          shouldValidate: true,
                                        })
                                        setOpenGarmentTypeIndex(null)
                                        setGarmentTypeSearch("")
                                      }}
                                      role="option"
                                      type="button"
                                      variant="ghost"
                                    >
                                      <span className="truncate">{type}</span>
                                      {selected && <CheckIcon className="size-4 shrink-0" />}
                                    </Button>
                                  )
                                }) : (
                                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                                    No se encontraron prendas.
                                  </p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
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
                <CardTitle>Carga por lote de tallas</CardTitle>
                <CardDescription>
                  Agrega varias prendas de la misma talla. Cada prenda conserva su propia fila para personalizar nombre y número.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-2 text-sm font-medium">
                  Tipo de prenda
                  <Popover
                    open={sizeBatchGarmentPickerOpen}
                    onOpenChange={(open) => {
                      setSizeBatchGarmentPickerOpen(open)
                      if (open) setSizeBatchGarmentSearch("")
                    }}
                  >
                    <PopoverTrigger
                      render={
                        <Button
                          aria-expanded={sizeBatchGarmentPickerOpen}
                          aria-label="Tipo de prenda del lote"
                          className="w-full justify-between"
                          role="combobox"
                          type="button"
                          variant="outline"
                        />
                      }
                    >
                      <span className="truncate">{sizeBatchGarment}</span>
                      <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(88vw,320px)] p-2">
                      <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          aria-label="Buscar tipo de prenda para lote"
                          autoFocus
                          className="pl-8"
                          onChange={(event) => setSizeBatchGarmentSearch(event.target.value)}
                          placeholder="Buscar entre todas las prendas…"
                          value={sizeBatchGarmentSearch}
                        />
                      </div>
                      <div
                        aria-label="Tipos de prenda para lote"
                        className="mt-2 max-h-56 overflow-y-auto"
                        role="listbox"
                      >
                        {visibleSizeBatchGarmentTypes.length > 0
                          ? visibleSizeBatchGarmentTypes.map((type) => {
                              const selected = sizeBatchGarment === type
                              return (
                                <Button
                                  aria-selected={selected}
                                  className="w-full justify-between"
                                  key={type}
                                  onClick={() => {
                                    setSizeBatchGarment(type)
                                    setSizeBatchGarmentPickerOpen(false)
                                    setSizeBatchGarmentSearch("")
                                  }}
                                  role="option"
                                  type="button"
                                  variant="ghost"
                                >
                                  <span className="truncate">{type}</span>
                                  {selected && <CheckIcon className="size-4 shrink-0" />}
                                </Button>
                              )
                            })
                          : (
                            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                              No se encontraron prendas.
                            </p>
                          )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Horma
                  <Select value={sizeBatchFit} onValueChange={(value) => value && setSizeBatchFit(value)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fits.map((fit) => <SelectItem key={fit} value={fit}>{fit}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Color
                  <Select value={selectedSizeBatchColor} onValueChange={(value) => value && setSizeBatchColor(value)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un color" /></SelectTrigger>
                    <SelectContent>
                      {sizeBatchColors.map((color) => (
                        <SelectItem key={color} value={color}>{color}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Talla
                  <Select value={selectedSizeBatchSize || null} onValueChange={(value) => value && setSizeBatchSize(value)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona una talla" /></SelectTrigger>
                    <SelectContent>
                      {sizeBatchSizes.map((size) => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Cantidad de prendas
                  <Input
                    min={1}
                    onChange={(event) => setSizeBatchQuantity(event.target.value)}
                    type="number"
                    value={sizeBatchQuantity}
                  />
                </label>
                <div className="flex items-end">
                  <Button className="w-full" onClick={addSizeBatch} type="button">
                    <PlusIcon data-icon="inline-start" /> Cargar lote
                  </Button>
                </div>
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
                        <TableRow
                          className={
                            index > 0 && watchedItems[index - 1]?.garment !== watchedItems[index]?.garment
                              ? "border-t-4 border-t-background"
                              : undefined
                          }
                          key={row.id}
                        >
                          <TableCell className={`min-w-36 border-l-2 pl-3 text-xs ${garmentColors.get(watchedItems[index]?.garment ?? "") ?? "border-l-border"}`}>
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
                    <Select
                      onValueChange={(value) => value && setBulkGarment(value)}
                      value={selectedBulkGarment}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {bulkGarmentOptions.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">
                    Horma
                    <Select
                      onValueChange={(value) => value && setBulkFit(value)}
                      value={selectedBulkFit}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {bulkFitOptions.map((fit) => <SelectItem key={fit} value={fit}>{fit}</SelectItem>)}
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
                            <TableRow
                              className={
                                index > 0 && watchedItems[index - 1]?.garment !== currentItem.garment
                                  ? "border-t-4 border-t-background"
                                  : undefined
                              }
                              key={row.id}
                            >
                              <TableCell className={`min-w-48 border-l-2 pl-3 ${garmentColors.get(currentItem.garment) ?? "border-l-border"}`}>
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
                  {!savedOrder && !savedQuotation && (
                    <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      Aún no se ha guardado un pedido. También puedes guardar esta información solo como cotización.
                    </p>
                  )}
                  {savedOrder && (
                    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                      <div>
                        <p className="font-medium">Pedido {savedOrder.id} guardado</p>
                        <p className="text-sm opacity-80">
                          El desprendible del pedido está listo para descargar.
                        </p>
                      </div>
                      <div>
                        <Button className="w-full" onClick={downloadReceipt} type="button">
                          Descargar desprendible PDF
                        </Button>
                      </div>
                      <p className="text-xs opacity-80">
                        Al descargar, elige «Guardar como PDF» en la ventana de impresión.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          className="w-full"
                          nativeButton={false}
                          render={<Link href="/dashboard/orders" />}
                          variant="outline"
                        >
                          <ListIcon data-icon="inline-start" /> Ir a pedidos
                        </Button>
                        <Button
                          className="w-full"
                          nativeButton={false}
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

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Cotización</CardTitle>
                  <CardDescription>
                    Guarda una propuesta sin consultar existencias, crear un pedido ni registrar pagos. Puedes adjuntar hasta 10 imágenes de referencia.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={Boolean(savedQuotation)}
                    multiple
                    onChange={selectReferenceImages}
                    ref={referenceImageInput}
                    type="file"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      disabled={Boolean(savedQuotation) || referenceImages.length >= maxReferenceImageCount}
                      onClick={() => referenceImageInput.current?.click()}
                      type="button"
                      variant="outline"
                    >
                      <ImagePlusIcon data-icon="inline-start" /> Agregar imágenes de referencia
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      JPG, PNG o WebP · máximo 5 MB por imagen · {referenceImages.length}/{maxReferenceImageCount}
                    </span>
                  </div>
                  {referenceImages.length > 0 && (
                    <ul className="space-y-2">
                      {referenceImages.map((image, index) => (
                        <li
                          className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                          key={`${image.name}-${image.lastModified}-${index}`}
                        >
                          <span className="min-w-0 truncate">{image.name}</span>
                          <Button
                            aria-label={`Quitar imagen ${image.name}`}
                            disabled={Boolean(savedQuotation)}
                            onClick={() => setReferenceImages((current) =>
                              current.filter((_, imageIndex) => imageIndex !== index),
                            )}
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          >
                            <XIcon />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {savedQuotation ? (
                    <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                      <div>
                        <p className="font-medium">Cotización {savedQuotation.quoteNumber} guardada</p>
                        <p className="text-sm opacity-80">
                          No se creó ningún pedido ni se registró pago. Las imágenes quedaron asociadas a la cotización.
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button className="w-full" onClick={downloadSavedQuotation} type="button">
                          Descargar / imprimir PDF
                        </Button>
                        <Button
                          className="w-full"
                          onClick={() => void shareSavedQuotation()}
                          type="button"
                          variant="outline"
                        >
                          Compartir cotización
                        </Button>
                        <Button
                          className="w-full"
                          nativeButton={false}
                          render={<Link href="/dashboard/quotations" />}
                          variant="outline"
                        >
                          Ver cotizaciones
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      disabled={isSavingQuotation || form.formState.isSubmitting}
                      onClick={() => void saveAsQuotation()}
                      type="button"
                    >
                      {isSavingQuotation
                        ? "Guardando cotización…"
                        : <><FileTextIcon data-icon="inline-start" /> Usar como cotización</>}
                    </Button>
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
                disabled={form.formState.isSubmitting || isSavingQuotation || Boolean(savedOrder)}
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
