"use client"

import { useEffect, useRef, useState } from "react"
import type { DragEvent, ReactNode } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  BarcodeIcon,
  BoxesIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  CreditCardIcon,
  FileTextIcon,
  ImagePlusIcon,
  LinkIcon,
  LockKeyholeIcon,
  PackagePlusIcon,
  ShirtIcon,
  TagsIcon,
  UploadCloudIcon,
  UserRoundIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { removeCatalogImage, uploadCatalogImage } from "@/lib/inventory/catalog-image-storage"

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

export function InventoryProductEditor({
  productId,
  returnTo = "/dashboard/inventory",
}: {
  productId?: string
  returnTo?: string
}) {
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
        <Button nativeButton={false} render={<Link href={returnTo} />} variant="outline">
          Volver al catálogo
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
      returnTo={returnTo}
    />
  )
}

function InventoryProductForm({
  companyId,
  inventoryProducts,
  product,
  productId,
  returnTo,
}: {
  companyId: string
  inventoryProducts: InventoryProduct[]
  product: InventoryProduct | null
  productId?: string
  returnTo: string
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
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageUrlField = formMethods.register("imageUrl")

  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
  }, [imagePreviewUrl])

  function selectImage(file: File | undefined) {
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      toast.error("La imagen debe ser JPG, PNG, WebP o AVIF.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar los 5 MB.")
      return
    }

    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  function handleImageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    selectImage(event.dataTransfer.files[0])
  }

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

    let uploadedImagePath: string | null = null
    let imageUrl = form.imageUrl.trim()
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
      if (imageFile) {
        const uploaded = await uploadCatalogImage(imageFile, {
          year: catalogYear,
          family: form.category,
          subcategory: form.subcategory,
        })
        uploadedImagePath = uploaded.path
        imageUrl = uploaded.publicUrl
      }

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
      router.push(returnTo)
      router.refresh()
    } catch (caught) {
      if (uploadedImagePath) {
        try {
          await removeCatalogImage(uploadedImagePath)
        } catch (cleanupError) {
          toast.error(cleanupError instanceof Error
            ? cleanupError.message
            : "No se pudo limpiar la imagen que quedó sin asociar.")
        }
      }
      toast.error(caught instanceof Error ? caught.message : "No se pudo guardar el producto.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button nativeButton={false} render={<Link href={returnTo} />} size="sm" variant="ghost">
        <ArrowLeftIcon data-icon="inline-start" /> Volver al catálogo
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

      <Card className="border-2 shadow-xl shadow-slate-950/20 ring-1 ring-slate-900/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardListIcon className="size-5" />
            Datos generales del producto
          </CardTitle>
          <CardDescription>
            {productId
              ? "Los cambios se guardan en Supabase. Las variantes existentes se conservan."
              : "Se creará la bodega principal si aún no existe y el stock inicial se asignará a cada variante."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-6"
            onSubmit={formMethods.handleSubmit(
              submit,
              () => toast.error("Revisa los campos del producto; hay valores inválidos."),
            )}
          >
            {Object.values(formMethods.formState.errors)[0]?.message && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                {Object.values(formMethods.formState.errors)[0]?.message}
              </p>
            )}

            <div className="grid gap-x-5 gap-y-4 lg:grid-cols-2">
              <Field icon={<UserRoundIcon />} label="Nombre del producto">
                <Input autoComplete="off" {...formMethods.register("name")} required />
              </Field>
              <Field icon={<CalendarDaysIcon />} label="Año del catálogo">
                <Select
                  onValueChange={(value) => value && updateTaxonomy("catalogYear", value)}
                  value={form.catalogYear}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogYears(inventoryProducts).map((year) => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field icon={<LockKeyholeIcon />} label="SKU">
                <Input aria-describedby="sku-help" readOnly value={form.sku} />
                <span className="text-xs font-normal text-muted-foreground" id="sku-help">
                  Se genera automáticamente según el año y tipo de producto.
                </span>
              </Field>
              <Field icon={<UsersRoundIcon />} label="Familia">
                <Select
                  onValueChange={(value) => {
                    if (!value || !(value in INVENTORY_FAMILIES)) return
                    const family = value as InventoryFamily
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
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(INVENTORY_FAMILIES).map((family) => (
                      <SelectItem key={family} value={family}>{family}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field icon={<ShirtIcon />} label="Subcategoría">
                <Select
                  onValueChange={(value) => value && updateTaxonomy("subcategory", value)}
                  value={form.subcategory}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_FAMILIES[form.category as InventoryFamily].map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field icon={<FileTextIcon />} label="Género">
                <Select
                  onValueChange={(value) => value && formMethods.setValue("gender", value, { shouldDirty: true })}
                  value={form.gender}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Unisex", "Hombre", "Mujer", "Infantil"].map((gender) => (
                      <SelectItem key={gender} value={gender}>{gender}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field icon={<CreditCardIcon />} label="Precio de venta (COP)">
                <Input min="0" required step="0.01" type="number" {...formMethods.register("price")} />
              </Field>
              <Field icon={<BarcodeIcon />} label="Código de barras">
                <Input {...formMethods.register("barcode")} />
              </Field>
              <Field icon={<FileTextIcon />} label="Descripción">
                <textarea
                  className="min-h-20 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                  {...formMethods.register("description")}
                />
              </Field>
              <Field icon={<LinkIcon />} label="URL de imagen">
                <Input
                  placeholder="https://..."
                  type="url"
                  {...imageUrlField}
                  onChange={(event) => {
                    imageUrlField.onChange(event)
                    if (imageFile) {
                      setImageFile(null)
                      setImagePreviewUrl("")
                    }
                  }}
                />
              </Field>

              <Field icon={<ImagePlusIcon />} label="Subir imagen al Storage">
                <div
                  className="space-y-3 rounded-lg border border-dashed bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleImageDrop}
                >
                  <input
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    onChange={(event) => {
                      selectImage(event.target.files?.[0])
                      event.target.value = ""
                    }}
                    ref={imageInputRef}
                    type="file"
                  />
                  {imagePreviewUrl || form.imageUrl || product?.imageUrl ? (
                    <div className="relative aspect-[4/3] overflow-hidden rounded-md border bg-background">
                      <Image
                        alt={`Vista previa de ${form.name || "la imagen del producto"}`}
                        className="object-contain p-2"
                        fill
                        sizes="(min-width: 1024px) 25vw, 100vw"
                        src={imagePreviewUrl || form.imageUrl || product?.imageUrl || ""}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <button
                      className="flex min-h-32 w-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"
                      onClick={() => imageInputRef.current?.click()}
                      type="button"
                    >
                      <UploadCloudIcon className="size-8" />
                      <span className="font-medium text-foreground">Arrastra el archivo aquí</span>
                      <span>o haz clic para buscar</span>
                    </button>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <Button
                      onClick={() => imageInputRef.current?.click()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <ImagePlusIcon data-icon="inline-start" />
                      {imagePreviewUrl ? "Cambiar imagen" : "Seleccionar imagen"}
                    </Button>
                    {imageFile ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="max-w-36 truncate text-xs text-muted-foreground">{imageFile.name}</span>
                        <Button
                          aria-label="Quitar imagen seleccionada"
                          onClick={() => {
                            setImageFile(null)
                            setImagePreviewUrl("")
                          }}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <XIcon />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">También puedes usar una URL</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP o AVIF · máximo 5 MB</p>
                </div>
              </Field>

              <div className="space-y-4">
                <Field icon={<TagsIcon />} label={productId ? "Agregar colores (separados por coma)" : "Colores (separados por coma)"}>
                  <Input placeholder="Azul marino, Blanco, Negro" {...formMethods.register("colors")} />
                  <div className="flex flex-wrap gap-1">
                    {uniqueValues(form.colors ?? "").map((color) => (
                      <Badge key={color} variant="secondary">{color}</Badge>
                    ))}
                  </div>
                </Field>
                <Field icon={<BoxesIcon />} label={productId ? "Agregar tallas (separadas por coma)" : "Tallas (separadas por coma)"}>
                  <Input placeholder="S, M, L, XL" {...formMethods.register("sizes")} />
                  <div className="flex flex-wrap gap-1">
                    {uniqueValues(form.sizes ?? "").map((size) => (
                      <Badge key={size} variant="outline">{size}</Badge>
                    ))}
                  </div>
                </Field>
                {productId && (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">Variantes registradas</p>
                    <p className="mt-1 text-muted-foreground">
                      {product?.variants.map((variant) => `${variant.color} · ${variant.size}`).join(", ") || "Sin variantes"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Las variantes existentes no se eliminan al editar la ficha.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 lg:col-span-2">
                <Field label="Stock inicial por variante">
                  <Input min="0" required step="1" type="number" {...formMethods.register("initialStock")} />
                </Field>
                <Field label="Mínimo">
                  <Input min="0" required step="1" type="number" {...formMethods.register("minStock")} />
                </Field>
                <Field label="Máximo">
                  <Input min="0" required step="1" type="number" {...formMethods.register("maxStock")} />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button disabled={saving} type="submit">
                <PackagePlusIcon data-icon="inline-start" />
                {saving ? "Guardando…" : productId ? "Guardar cambios" : "Crear producto"}
              </Button>
              <Button nativeButton={false} render={<Link href={returnTo} />} variant="outline">
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

function Field({
  icon,
  label,
  children,
}: {
  icon?: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      <span className="flex items-center gap-2">
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
        {label}
      </span>
      {children}
    </label>
  )
}
