"use client"

import { useEffect, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getVariantReservations,
  MAIN_WAREHOUSE,
  type InventoryMovementType,
  type InventoryProduct,
} from "@/lib/inventory/demo-inventory"
import {
  saveSupabaseInventoryMovement,
  saveSupabaseProduct,
  useDemoInventory,
} from "@/lib/inventory/use-demo-inventory"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"

const movementTypes: InventoryMovementType[] = ["Entrada", "Salida", "Transferencia", "Ajuste"]
const initialProductForm = {
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

type ProductForm = typeof initialProductForm

export function InventoryManager() {
  const { orders, error: ordersError } = useDemoOrders()
  const { inventory, error: storageError, refresh: refreshInventory } = useDemoInventory()
  const { companyId } = useOrdersOperator()
  const [query, setQuery] = useState("")
  const [warehouseFilter, setWarehouseFilter] = useState("Todos")
  const [visibleRows, setVisibleRows] = useState(12)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm)
  const [movementForm, setMovementForm] = useState({
    type: "Entrada" as InventoryMovementType,
    variantId: "",
    quantity: "1",
    warehouse: MAIN_WAREHOUSE,
    destination: "",
    reference: "",
    note: "",
  })

  useEffect(() => {
    if (ordersError) toast.error(ordersError)
  }, [ordersError])

  const warehouses = useMemo(() => {
    const names = new Set([MAIN_WAREHOUSE])
    for (const product of inventory?.products ?? []) {
      for (const variant of product.variants) {
        for (const name of Object.keys(variant.stockByWarehouse)) names.add(name)
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, "es"))
  }, [inventory])
  const reservations = useMemo(
    () => getVariantReservations(inventory?.products ?? [], orders),
    [inventory, orders],
  )
  const variants = useMemo(
    () => (inventory?.products ?? []).flatMap((product) =>
      product.variants.map((variant) => ({ product, variant })),
    ),
    [inventory],
  )
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return variants.flatMap(({ product, variant }) => {
      const matchesQuery = !normalizedQuery
        || `${product.name} ${product.sku} ${product.category} ${product.gender} ${variant.color} ${variant.size} ${variant.barcode}`
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      if (!matchesQuery) return []
      const locations = warehouseFilter === "Todos"
        ? [null]
        : [warehouseFilter]
      return locations.map((warehouse) => ({
        product,
        variant,
        warehouse,
        stock: warehouse
          ? variant.stockByWarehouse[warehouse] ?? 0
          : Object.values(variant.stockByWarehouse).reduce((total, amount) => total + amount, 0),
      }))
    })
  }, [query, variants, warehouseFilter])

  const totalStock = variants.reduce(
    (total, { variant }) => total + Object.values(variant.stockByWarehouse).reduce((sum, amount) => sum + amount, 0),
    0,
  )
  const totalReserved = [...reservations.values()].reduce((total, amount) => total + amount, 0)
  const lowStockCount = variants.filter(({ variant }) =>
    Object.values(variant.stockByWarehouse).reduce((sum, amount) => sum + amount, 0)
      - (reservations.get(variant.id) ?? 0) <= variant.minStock,
  ).length

  function updateProductField<K extends keyof ProductForm>(field: K, value: ProductForm[K]) {
    setProductForm((current) => ({ ...current, [field]: value }))
  }

  function editProduct(product: InventoryProduct) {
    setEditingProductId(product.id)
    setProductForm({
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
    })
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inventory) return
    const sku = productForm.sku.trim()
    const name = productForm.name.trim()
    const price = Number(productForm.price)
    const minStock = Number(productForm.minStock)
    const maxStock = Number(productForm.maxStock)
    if (!sku || !name || !Number.isFinite(price) || price < 0) {
      toast.error("Completa el SKU, el nombre y un precio válido.")
      return
    }
    if (!Number.isInteger(minStock) || !Number.isInteger(maxStock) || minStock < 0 || maxStock < minStock) {
      toast.error("El stock mínimo y máximo deben ser enteros válidos.")
      return
    }
    const duplicateSku = inventory.products.some(
      (product) => product.sku.toLocaleLowerCase() === sku.toLocaleLowerCase()
        && product.id !== editingProductId,
    )
    if (duplicateSku) {
      toast.error("Ya existe un producto con ese SKU.")
      return
    }
    const duplicateName = inventory.products.some(
      (product) => product.name.toLocaleLowerCase() === name.toLocaleLowerCase()
        && product.id !== editingProductId,
    )
    if (duplicateName) {
      toast.error("El nombre del producto debe ser único para vincularlo con los pedidos.")
      return
    }
    const editedProduct = inventory.products.find((product) => product.id === editingProductId)
    if (editedProduct
      && editedProduct.name !== name
      && orders.some((order) => order.items.some((item) => item.garment === editedProduct.name))) {
      toast.error("No se puede cambiar el nombre: el producto está vinculado a pedidos existentes.")
      return
    }
    const imageUrl = productForm.imageUrl.trim()
    if (imageUrl) {
      try {
        const parsedImageUrl = new URL(imageUrl)
        if (parsedImageUrl.protocol !== "http:" && parsedImageUrl.protocol !== "https:") {
          throw new Error("La imagen debe usar una URL HTTP o HTTPS.")
        }
      } catch {
        toast.error("Ingresa una URL de imagen válida que use HTTP o HTTPS.")
        return
      }
    }

    const colorOptions = [...new Set(productForm.colors.split(",").map((color) => color.trim()).filter(Boolean))]
    const sizeOptions = [...new Set(productForm.sizes.split(",").map((size) => size.trim()).filter(Boolean))]
    const initialStock = Number(productForm.initialStock)
    if (Boolean(colorOptions.length) !== Boolean(sizeOptions.length)) {
      toast.error("Para agregar variantes, indica al menos un color y una talla.")
      return
    }
    if (!editingProductId && (!colorOptions.length || !sizeOptions.length)) {
      toast.error("Agrega al menos un color y una talla separados por coma.")
      return
    }
    if (!Number.isInteger(initialStock) || initialStock < 0) {
      toast.error("El stock inicial debe ser un entero igual o mayor a cero.")
      return
    }
    const barcodePrefix = productForm.barcode.trim()
    const variantInputs = colorOptions.flatMap((color) =>
      sizeOptions.map((size) => ({
        color,
        size,
        barcode: `${barcodePrefix || sku}-${color}-${size}`,
      })),
    )
    try {
      await saveSupabaseProduct(companyId, {
        id: editingProductId,
        sku,
        name,
        description: productForm.description.trim(),
        category: productForm.category.trim() || "Sin categoría",
        gender: productForm.gender,
        price,
        barcode: barcodePrefix,
        imageUrl,
        variants: variantInputs,
        initialStock,
        minStock,
        maxStock,
      })
      await refreshInventory()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el producto.")
      return
    }
    setProductForm(initialProductForm)
    setEditingProductId(null)
    toast.success(editingProductId
      ? "Ficha y variantes guardadas correctamente."
      : `Producto creado con ${variantInputs.length} variantes de color y talla.`)
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inventory) return
    const quantity = Number(movementForm.quantity)
    try {
      if (!Number.isInteger(quantity) || quantity === 0) {
        throw new Error("Ingresa una cantidad entera distinta de cero.")
      }
      await saveSupabaseInventoryMovement(companyId, {
        ...movementForm,
        quantity,
      })
      await refreshInventory()
      setMovementForm((current) => ({
        ...current,
        quantity: "1",
        reference: "",
        note: "",
      }))
      toast.success("Movimiento de inventario registrado.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el movimiento.")
    }
  }

  if (storageError) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm">
        <h1 className="font-semibold">No se pudo cargar el inventario</h1>
        <p className="mt-1 text-muted-foreground">{storageError}</p>
      </div>
    )
  }
  if (!inventory) {
    return <p className="text-sm text-muted-foreground">Cargando inventario…</p>
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Operación / Módulos</p>
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo, existencias por variante y almacén, reservas de pedidos y trazabilidad de movimientos.
        </p>
      </div>
      <div
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        role="note"
      >
        El catálogo, las existencias y los movimientos se guardan en Supabase para la empresa activa.
      </div>

      <section aria-label="Resumen de inventario" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Productos" value={String(inventory.products.length)} detail="Modelos en catálogo" />
        <MetricCard label="Variantes" value={String(variants.length)} detail="Combinaciones de color y talla" />
        <MetricCard label="Unidades reservadas" value={String(totalReserved)} detail="Pedidos no entregados" />
        <MetricCard label="Alertas de stock bajo" value={String(lowStockCount)} detail={`${totalStock} unidades en existencias`} />
      </section>

      {lowStockCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas de stock bajo</CardTitle>
            <CardDescription>Variantes con existencias iguales o inferiores a su mínimo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {variants.filter(({ variant }) =>
              Object.values(variant.stockByWarehouse).reduce((sum, amount) => sum + amount, 0)
                - (reservations.get(variant.id) ?? 0) <= variant.minStock,
            ).slice(0, 12).map(({ product, variant }) => (
              <Badge key={variant.id} variant="outline">
                {product.name} · {variant.color} · {variant.size}: {Object.values(variant.stockByWarehouse).reduce((sum, amount) => sum + amount, 0)} u
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{editingProductId ? "Editar producto" : "Agregar producto"}</CardTitle>
            <CardDescription>
              {editingProductId
                ? "Actualiza la ficha comercial. Las existencias solo se modifican con movimientos."
                : "Registra la ficha y genera variantes para cada combinación de color y talla."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveProduct}>
              <FormField label="SKU">
                <Input required value={productForm.sku} onChange={(event) => updateProductField("sku", event.target.value)} />
              </FormField>
              <FormField label="Nombre del producto">
                <Input required value={productForm.name} onChange={(event) => updateProductField("name", event.target.value)} />
              </FormField>
              <FormField label="Categoría">
                <Input value={productForm.category} onChange={(event) => updateProductField("category", event.target.value)} />
              </FormField>
              <FormField label="Género">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={productForm.gender} onChange={(event) => updateProductField("gender", event.target.value)}>
                  {["Unisex", "Hombre", "Mujer", "Infantil"].map((gender) => <option key={gender}>{gender}</option>)}
                </select>
              </FormField>
              <FormField label="Precio de venta (COP)">
                <Input min="0" required type="number" value={productForm.price} onChange={(event) => updateProductField("price", event.target.value)} />
              </FormField>
              <FormField label="Código de barras">
                <Input value={productForm.barcode} onChange={(event) => updateProductField("barcode", event.target.value)} />
              </FormField>
              <FormField label="Descripción">
                <Input value={productForm.description} onChange={(event) => updateProductField("description", event.target.value)} />
              </FormField>
              <FormField label="URL de imagen">
                <Input type="url" value={productForm.imageUrl} onChange={(event) => updateProductField("imageUrl", event.target.value)} />
              </FormField>
              <FormField label={editingProductId ? "Agregar colores (separados por coma)" : "Colores (separados por coma)"}>
                <Input required={!editingProductId} value={productForm.colors} onChange={(event) => updateProductField("colors", event.target.value)} />
              </FormField>
              <FormField label={editingProductId ? "Agregar tallas (separadas por coma)" : "Tallas (separadas por coma)"}>
                <Input required={!editingProductId} value={productForm.sizes} onChange={(event) => updateProductField("sizes", event.target.value)} />
              </FormField>
              <FormField label="Stock inicial por variante nueva">
                <Input min="0" required type="number" value={productForm.initialStock} onChange={(event) => updateProductField("initialStock", event.target.value)} />
              </FormField>
              <FormField label="Stock mínimo">
                <Input min="0" required type="number" value={productForm.minStock} onChange={(event) => updateProductField("minStock", event.target.value)} />
              </FormField>
              <FormField label="Stock máximo">
                <Input min="0" required type="number" value={productForm.maxStock} onChange={(event) => updateProductField("maxStock", event.target.value)} />
              </FormField>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">{editingProductId ? "Guardar cambios" : "Crear producto"}</Button>
                {editingProductId && (
                  <Button onClick={() => { setEditingProductId(null); setProductForm(initialProductForm) }} type="button" variant="outline">
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrar movimiento</CardTitle>
            <CardDescription>Entradas, salidas, transferencias y ajustes con validación de reservas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveMovement}>
              <FormField label="Tipo">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={movementForm.type} onChange={(event) => setMovementForm({ ...movementForm, type: event.target.value as InventoryMovementType })}>
                  {movementTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </FormField>
              <FormField label="Producto · color · talla">
                <select className="h-9 min-w-0 rounded-md border border-input bg-background px-3 text-sm" required value={movementForm.variantId} onChange={(event) => setMovementForm({ ...movementForm, variantId: event.target.value })}>
                  <option value="">Selecciona variante</option>
                  {variants.map(({ product, variant }) => (
                    <option key={variant.id} value={variant.id}>{product.name} · {variant.color} · {variant.size}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={movementForm.type === "Ajuste" ? "Cantidad (+ suma, − resta)" : "Cantidad"}>
                <Input required type="number" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} />
              </FormField>
              <FormField label={movementForm.type === "Transferencia" ? "Almacén de origen" : "Almacén"}>
                <Input list="inventory-warehouses" required value={movementForm.warehouse} onChange={(event) => setMovementForm({ ...movementForm, warehouse: event.target.value })} />
                <datalist id="inventory-warehouses">{warehouses.map((name) => <option key={name} value={name} />)}</datalist>
              </FormField>
              {movementForm.type === "Transferencia" && (
                <FormField label="Almacén de destino">
                  <Input required value={movementForm.destination} onChange={(event) => setMovementForm({ ...movementForm, destination: event.target.value })} />
                </FormField>
              )}
              <FormField label="Referencia (pedido, factura)">
                <Input value={movementForm.reference} onChange={(event) => setMovementForm({ ...movementForm, reference: event.target.value })} />
              </FormField>
              <FormField label="Nota">
                <Input value={movementForm.note} onChange={(event) => setMovementForm({ ...movementForm, note: event.target.value })} />
              </FormField>
              <div className="sm:col-span-2">
                <Button type="submit">Guardar movimiento</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Existencias por variante</CardTitle>
              <CardDescription>Las reservas se asignan a Bodega principal. Disponible total = stock físico − reservado por pedidos activos.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Buscar productos y variantes" className="w-56" onChange={(event) => { setQuery(event.target.value); setVisibleRows(12) }} placeholder="Buscar SKU, producto, talla…" value={query} />
              <select aria-label="Filtrar por almacén" className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
                <option>Todos</option>
                {warehouses.map((warehouse) => <option key={warehouse}>{warehouse}</option>)}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU / Producto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Almacén</TableHead>
                  <TableHead>Código de barras</TableHead>
                  <TableHead>Stock en almacén</TableHead>
                  <TableHead>Mín. / Máx.</TableHead>
                  <TableHead>Reservado total</TableHead>
                  <TableHead>Disponible total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.slice(0, visibleRows).map(({ product, variant, warehouse, stock }) => {
                  const reserved = reservations.get(variant.id) ?? 0
                  const available = Math.max(0, Object.values(variant.stockByWarehouse).reduce((sum, amount) => sum + amount, 0) - reserved)
                  const physical = Object.values(variant.stockByWarehouse).reduce((sum, amount) => sum + amount, 0)
                  const low = available <= variant.minStock
                  const overMaximum = physical > variant.maxStock
                  return (
                    <TableRow key={`${variant.id}-${warehouse ?? "all"}`}>
                      <TableCell><div className="font-medium">{product.name}</div><div className="text-xs text-muted-foreground">{product.sku} · {product.category} · {product.gender}</div></TableCell>
                      <TableCell>{variant.color} · {variant.size}</TableCell>
                      <TableCell>{warehouse ?? "Todos los almacenes"}</TableCell>
                      <TableCell className="font-mono text-xs">{variant.barcode}</TableCell>
                      <TableCell>{stock}</TableCell>
                      <TableCell>{variant.minStock} / {variant.maxStock}</TableCell>
                      <TableCell>{reserved}</TableCell>
                      <TableCell className="font-medium">{available}</TableCell>
                      <TableCell><Badge variant={low ? "destructive" : overMaximum ? "outline" : "secondary"}>{low ? "Stock bajo" : overMaximum ? "Sobre máximo" : "Disponible"}</Badge></TableCell>
                    </TableRow>
                  )
                })}
                {filteredRows.length === 0 && (
                  <TableRow><TableCell className="h-20 text-center text-muted-foreground" colSpan={9}>No hay variantes que coincidan con la búsqueda.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {visibleRows < filteredRows.length && (
            <Button onClick={() => setVisibleRows((count) => count + 12)} variant="outline">Mostrar más variantes</Button>
          )}
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-medium">Catálogo de productos</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {inventory.products.map((product) => (
                <div className="flex items-center justify-between gap-3 rounded-md border p-3" key={product.id}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{product.sku} · {product.variants.length} variantes · {formatCurrency(product.price)} · {product.barcode || "Sin código"}</p>
                      {product.description && <p className="truncate text-xs text-muted-foreground">{product.description}</p>}
                      {product.imageUrl && <a className="text-xs text-primary hover:underline" href={product.imageUrl} rel="noreferrer" target="_blank">Ver imagen</a>}
                    </div>
                  </div>
                  <Button onClick={() => editProduct(product)} size="sm" variant="outline">Editar ficha</Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
          <CardDescription>El historial registra la variante, almacén, referencia y cantidad de cada operación.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Producto</TableHead><TableHead>Variante</TableHead><TableHead>Cantidad</TableHead><TableHead>Almacén</TableHead><TableHead>Referencia</TableHead><TableHead>Nota</TableHead></TableRow></TableHeader>
            <TableBody>
              {inventory.movements.slice(0, 20).map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(movement.date))}</TableCell>
                  <TableCell>{movement.type}</TableCell>
                  <TableCell>{movement.productName}</TableCell>
                  <TableCell>{movement.variantName}</TableCell>
                  <TableCell>{movement.type === "Transferencia" ? Math.abs(movement.quantity) : movement.quantity}</TableCell>
                  <TableCell>{movement.type === "Transferencia" ? `${movement.warehouse} → ${movement.destination}` : movement.warehouse}</TableCell>
                  <TableCell>{movement.reference || "—"}</TableCell>
                  <TableCell>{movement.note || "—"}</TableCell>
                </TableRow>
              ))}
              {inventory.movements.length === 0 && (
                <TableRow><TableCell className="h-20 text-center text-muted-foreground" colSpan={8}>Todavía no hay movimientos registrados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  )
}
