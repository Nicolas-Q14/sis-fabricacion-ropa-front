"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, PackagePlusIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"
import {
  createInventorySku,
  DEFAULT_CATALOG_YEAR,
  INVENTORY_FAMILIES,
  type InventoryFamily,
} from "@/lib/inventory/catalog-structure"
import type { InventoryProduct } from "@/lib/inventory/demo-inventory"
import { saveSupabaseProduct, useDemoInventory } from "@/lib/inventory/use-demo-inventory"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"

const emptyForm = {
  sku: "",
  name: "",
  description: "",
  category: "Textiles",
  subcategory: "camisetas",
  catalogYear: String(DEFAULT_CATALOG_YEAR),
  gender: "Unisex",
  price: "",
  barcode: "",
  imageUrl: "",
  colors: "Azul marino, Blanco",
  sizes: "S, M, L",
  initialStock: "0",
  minStock: "5",
  maxStock: "100",
}

type ProductForm = typeof emptyForm
const productFormSchema = z.object({
  sku: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  subcategory: z.string(),
  catalogYear: z.string(),
  gender: z.string(),
  price: z.string(),
  barcode: z.string(),
  imageUrl: z.string(),
  colors: z.string(),
  sizes: z.string(),
  initialStock: z.string(),
  minStock: z.string(),
  maxStock: z.string(),
}).superRefine((form, context) => {
  if (!form.name.trim()) {
    context.addIssue({ code: "custom", message: "El nombre del producto es obligatorio.", path: ["name"] })
  }
  if (!/^\d{4}$/.test(form.catalogYear) || Number(form.catalogYear) < 2000 || Number(form.catalogYear) > 2100) {
    context.addIssue({ code: "custom", message: "Ingresa un año de catálogo válido.", path: ["catalogYear"] })
  }
  if (!/^\d+(\.\d{1,2})?$/.test(form.price) || Number(form.price) < 0) {
    context.addIssue({ code: "custom", message: "Ingresa un precio válido.", path: ["price"] })
  }
  for (const field of ["initialStock", "minStock", "maxStock"] as const) {
    if (!/^\d+$/.test(form[field])) {
      context.addIssue({ code: "custom", message: "Ingresa una cantidad entera igual o mayor a cero.", path: [field] })
    }
  }
  if (Number(form.maxStock) < Number(form.minStock)) {
    context.addIssue({ code: "custom", message: "El stock máximo debe ser igual o superior al mínimo.", path: ["maxStock"] })
  }
  if (form.imageUrl.trim()) {
    try {
      const parsed = new URL(form.imageUrl)
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error()
    } catch {
      context.addIssue({ code: "custom", message: "La imagen debe usar una URL HTTP o HTTPS válida.", path: ["imageUrl"] })
    }
  }
})

export function InventoryProductEditor({ productId }: { productId?: string }) {
  const { companyId } = useOrdersOperator()
  const { inventory, error } = useDemoInventory()

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm">
        <h1 className="font-semibold">No se pudo cargar el inventario</h1>
        <p className="mt-1 text-muted-foreground">{error}</p>
      </div>
    )
  }
  if (!inventory) {
    return (
      <div aria-label="Cargando ficha de producto" className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const product = productId
    ? inventory.products.find((item) => item.id === productId) ?? null
    : null
  if (productId && !product) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Producto no encontrado</h1>
        <Button nativeButton={false} render={<Link href="/dashboard/inventory" />} variant="outline">
          Volver al inventario
        </Button>
      </section>
    )
  }

  return (
    <InventoryProductForm
      companyId={companyId}
      inventoryProducts={inventory.products}
      key={productId ?? "new-product"}
      product={product}
      productId={productId}
    />
  )
}

function InventoryProductForm({
  companyId,
  inventoryProducts,
  product,
  productId,
}: {
  companyId: string
  inventoryProducts: InventoryProduct[]
  product: InventoryProduct | null
  productId?: string
}) {
  const router = useRouter()
  const { orders } = useDemoOrders()
  const formMethods = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product
      ? formFromProduct(product)
      : {
          ...emptyForm,
          sku: createInventorySku(DEFAULT_CATALOG_YEAR, "Textiles", "camisetas", inventoryProducts),
        },
  })
  const form = useWatch({ control: formMethods.control })
  const [saving, setSaving] = useState(false)

  function updateTaxonomy(
    field: "catalogYear" | "category" | "subcategory",
    value: string,
  ) {
    const next = { ...formMethods.getValues(), [field]: value }
    const family = next.category as InventoryFamily
    formMethods.setValue(field, value, { shouldDirty: true, shouldValidate: true })
    formMethods.setValue("sku", createInventorySku(
      Number(next.catalogYear),
      family,
      next.subcategory,
      inventoryProducts,
      productId,
    ), { shouldDirty: true })
  }

  async function submit(values: ProductForm) {
    const form = values
    const sku = form.sku.trim()
    const name = form.name.trim()
    const price = Number(form.price)
    const minStock = Number(form.minStock)
    const maxStock = Number(form.maxStock)
    const initialStock = Number(form.initialStock)
    const catalogYear = Number(form.catalogYear)
    const familyOptions = INVENTORY_FAMILIES[form.category as InventoryFamily]
    if (!Number.isInteger(catalogYear) || !familyOptions
      || !familyOptions.some((option) => option.value === form.subcategory)) {
      toast.error("Selecciona un catálogo, familia y subcategoría válidos.")
      return
    }
    if (!sku || !name || !Number.isFinite(price) || price < 0) {
      toast.error("Completa el SKU, el nombre y un precio válido.")
      return
    }
    if (!Number.isInteger(minStock) || !Number.isInteger(maxStock)
      || minStock < 0 || maxStock < minStock) {
      toast.error("El stock mínimo y máximo deben ser enteros válidos.")
      return
    }
    if (!Number.isInteger(initialStock) || initialStock < 0) {
      toast.error("El stock inicial debe ser un entero igual o mayor a cero.")
      return
    }
    if (inventoryProducts.some((item) =>
      item.sku.toLocaleLowerCase() === sku.toLocaleLowerCase()
      && item.id !== productId)) {
      toast.error("Ya existe un producto con ese SKU.")
      return
    }
    if (inventoryProducts.some((item) =>
      item.name.toLocaleLowerCase() === name.toLocaleLowerCase()
      && item.id !== productId)) {
      toast.error("Ya existe un producto con ese nombre.")
      return
    }
    if (product && product.name !== name
      && orders.some((order) => order.items.some((item) => item.garment === product.name))) {
      toast.error("No se puede cambiar el nombre porque el producto ya está asociado a pedidos.")
      return
    }

    const imageUrl = form.imageUrl.trim()
    if (imageUrl) {
      try {
        const parsedUrl = new URL(imageUrl)
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          throw new Error("La imagen debe usar HTTP o HTTPS.")
        }
      } catch {
        toast.error("Ingresa una URL de imagen válida que use HTTP o HTTPS.")
        return
      }
    }

    const colors = uniqueValues(form.colors)
    const sizes = uniqueValues(form.sizes)
    if (Boolean(colors.length) !== Boolean(sizes.length)) {
      toast.error("Indica colores y tallas para generar nuevas variantes.")
      return
    }
    if (!productId && (!colors.length || !sizes.length)) {
      toast.error("Agrega al menos un color y una talla.")
      return
    }
    const variants = colors.flatMap((color) =>
      sizes.map((size) => ({
        color,
        size,
        barcode: `${form.barcode.trim() || sku}-${color}-${size}`,
      })),
    )

    setSaving(true)
    try {
      await saveSupabaseProduct(companyId, {
        id: productId ?? null,
        sku,
        name,
        description: form.description.trim(),
        category: form.category,
        subcategory: form.subcategory,
        catalogYear,
        gender: form.gender,
        price,
        barcode: form.barcode.trim(),
        imageUrl,
        variants,
        initialStock,
        minStock,
        maxStock,
      })
      toast.success(productId
        ? variants.length
          ? "Producto actualizado y nuevas variantes creadas con sus existencias."
          : "Producto actualizado correctamente."
        : `Producto creado con ${variants.length} variantes y ${initialStock} unidades por variante.`)
      router.push("/dashboard/inventory")
      router.refresh()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo guardar el producto.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button nativeButton={false} render={<Link href="/dashboard/inventory" />} size="sm" variant="ghost">
        <ArrowLeftIcon data-icon="inline-start" /> Volver al inventario
      </Button>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Inventario / Catálogo</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {productId ? "Editar producto" : "Crear producto"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Registra la ficha y administra variantes con existencias disponibles al guardar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlusIcon className="size-5" />
            Datos del producto
          </CardTitle>
          <CardDescription>
            {productId
              ? "Los cambios se guardan en Supabase. Las variantes existentes se conservan."
              : "Se creará la bodega principal si aún no existe y el stock inicial se asignará a cada variante."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={formMethods.handleSubmit(
              submit,
              () => toast.error("Revisa los campos del producto; hay valores inválidos."),
            )}
          >
            {Object.values(formMethods.formState.errors)[0]?.message && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive sm:col-span-2">
                {Object.values(formMethods.formState.errors)[0]?.message}
              </p>
            )}
            <Field label="SKU">
              <Input aria-describedby="sku-help" readOnly value={form.sku} />
              <span className="text-xs font-normal text-muted-foreground" id="sku-help">
                Se genera automáticamente según el año y tipo de producto.
              </span>
            </Field>
            <Field label="Nombre del producto">
              <Input {...formMethods.register("name")} required />
            </Field>
            <Field label="Catálogo">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => updateTaxonomy("catalogYear", event.target.value)}
                value={form.catalogYear}
              >
                {catalogYears(inventoryProducts).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </Field>
            <Field label="Familia">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => {
                  const family = event.target.value as InventoryFamily
                  const subcategory = INVENTORY_FAMILIES[family][0].value
                  formMethods.setValue("category", family, { shouldDirty: true, shouldValidate: true })
                  formMethods.setValue("subcategory", subcategory, { shouldDirty: true, shouldValidate: true })
                  formMethods.setValue("sku", createInventorySku(
                    Number(formMethods.getValues("catalogYear")),
                    family,
                    subcategory,
                    inventoryProducts,
                    productId,
                  ), { shouldDirty: true })
                }}
                value={form.category}
              >
                {Object.keys(INVENTORY_FAMILIES).map((family) => (
                  <option key={family} value={family}>{family}</option>
                ))}
              </select>
            </Field>
            <Field label="Subcategoría">
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => updateTaxonomy("subcategory", event.target.value)}
                value={form.subcategory}
              >
                {INVENTORY_FAMILIES[form.category as InventoryFamily].map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Género">
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" {...formMethods.register("gender")}>
                {["Unisex", "Hombre", "Mujer", "Infantil"].map((gender) => <option key={gender}>{gender}</option>)}
              </select>
            </Field>
            <Field label="Precio de venta (COP)">
              <Input min="0" required step="0.01" type="number" {...formMethods.register("price")} />
            </Field>
            <Field label="Código de barras">
              <Input {...formMethods.register("barcode")} />
            </Field>
            <Field label="Descripción">
              <Input {...formMethods.register("description")} />
            </Field>
            <Field label="URL de imagen">
              <Input type="url" {...formMethods.register("imageUrl")} />
            </Field>
            {productId && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm sm:col-span-2">
                <p className="font-medium">Variantes registradas</p>
                <p className="mt-1 text-muted-foreground">
                  {product?.variants.map((variant) => `${variant.color} · ${variant.size}`).join(", ") || "Sin variantes"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Las variantes existentes no se eliminan al editar la ficha.
                </p>
              </div>
            )}
            <Field label={productId ? "Agregar colores (separados por coma)" : "Colores (separados por coma)"}>
              <Input placeholder="Azul marino, Blanco, Negro" {...formMethods.register("colors")} />
            </Field>
            <Field label={productId ? "Agregar tallas (separadas por coma)" : "Tallas (separadas por coma)"}>
              <Input placeholder="S, M, L, XL" {...formMethods.register("sizes")} />
            </Field>
            <Field label="Stock inicial por cada variante nueva">
              <Input min="0" required step="1" type="number" {...formMethods.register("initialStock")} />
            </Field>
            <Field label="Stock mínimo por variante">
              <Input min="0" required step="1" type="number" {...formMethods.register("minStock")} />
            </Field>
            <Field label="Stock máximo por variante">
              <Input min="0" required step="1" type="number" {...formMethods.register("maxStock")} />
            </Field>
            <div className="flex gap-2 pt-2 sm:col-span-2">
              <Button disabled={saving} type="submit">
                {saving ? "Guardando…" : productId ? "Guardar cambios" : "Crear producto"}
              </Button>
              <Button nativeButton={false} render={<Link href="/dashboard/inventory" />} variant="outline">
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function formFromProduct(product: InventoryProduct): ProductForm {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    subcategory: product.subcategory || "otros",
    catalogYear: String(product.catalogYear || DEFAULT_CATALOG_YEAR),
    gender: product.gender,
    price: String(product.price),
    barcode: product.barcode,
    imageUrl: product.imageUrl,
    colors: "",
    sizes: "",
    initialStock: "0",
    minStock: String(product.variants[0]?.minStock ?? 0),
    maxStock: String(product.variants[0]?.maxStock ?? 100),
  }
}

function catalogYears(products: InventoryProduct[]) {
  return [...new Set([
    2024,
    2025,
    2026,
    new Date().getFullYear(),
    ...products.map((product) => product.catalogYear),
  ])].sort((left, right) => right - left)
}

function uniqueValues(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  )
}
