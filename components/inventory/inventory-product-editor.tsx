"use client"

import { useState } from "react"
import type { FormEvent, ReactNode } from "react"
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
import { useOrdersOperator } from "@/components/orders/orders-operator-context"
import type { InventoryProduct } from "@/lib/inventory/demo-inventory"
import { saveSupabaseProduct, useDemoInventory } from "@/lib/inventory/use-demo-inventory"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"

const emptyForm = {
  sku: "",
  name: "",
  description: "",
  category: "Uniformes",
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
  if (!inventory) return <p className="text-sm text-muted-foreground">Cargando inventario…</p>

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
  const [form, setForm] = useState<ProductForm>(() =>
    product ? formFromProduct(product) : emptyForm)
  const [saving, setSaving] = useState(false)

  function updateField<K extends keyof ProductForm>(field: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const sku = form.sku.trim()
    const name = form.name.trim()
    const price = Number(form.price)
    const minStock = Number(form.minStock)
    const maxStock = Number(form.maxStock)
    const initialStock = Number(form.initialStock)
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
        category: form.category.trim() || "Sin categoría",
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
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
            <Field label="SKU">
              <Input required value={form.sku} onChange={(event) => updateField("sku", event.target.value)} />
            </Field>
            <Field label="Nombre del producto">
              <Input required value={form.name} onChange={(event) => updateField("name", event.target.value)} />
            </Field>
            <Field label="Categoría">
              <Input value={form.category} onChange={(event) => updateField("category", event.target.value)} />
            </Field>
            <Field label="Género">
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.gender} onChange={(event) => updateField("gender", event.target.value)}>
                {["Unisex", "Hombre", "Mujer", "Infantil"].map((gender) => <option key={gender}>{gender}</option>)}
              </select>
            </Field>
            <Field label="Precio de venta (COP)">
              <Input min="0" required type="number" value={form.price} onChange={(event) => updateField("price", event.target.value)} />
            </Field>
            <Field label="Código de barras">
              <Input value={form.barcode} onChange={(event) => updateField("barcode", event.target.value)} />
            </Field>
            <Field label="Descripción">
              <Input value={form.description} onChange={(event) => updateField("description", event.target.value)} />
            </Field>
            <Field label="URL de imagen">
              <Input type="url" value={form.imageUrl} onChange={(event) => updateField("imageUrl", event.target.value)} />
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
              <Input required={!productId} placeholder="Azul marino, Blanco, Negro" value={form.colors} onChange={(event) => updateField("colors", event.target.value)} />
            </Field>
            <Field label={productId ? "Agregar tallas (separadas por coma)" : "Tallas (separadas por coma)"}>
              <Input required={!productId} placeholder="S, M, L, XL" value={form.sizes} onChange={(event) => updateField("sizes", event.target.value)} />
            </Field>
            <Field label="Stock inicial por cada variante nueva">
              <Input min="0" required type="number" value={form.initialStock} onChange={(event) => updateField("initialStock", event.target.value)} />
            </Field>
            <Field label="Stock mínimo por variante">
              <Input min="0" required type="number" value={form.minStock} onChange={(event) => updateField("minStock", event.target.value)} />
            </Field>
            <Field label="Stock máximo por variante">
              <Input min="0" required type="number" value={form.maxStock} onChange={(event) => updateField("maxStock", event.target.value)} />
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
