"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  type InventoryProduct,
} from "@/lib/inventory/demo-inventory"
import { deleteSupabaseProduct, useDemoInventory } from "@/lib/inventory/use-demo-inventory"

export function InventoryManager() {
  const { companyId } = useOrdersOperator()
  const { inventory, error, refresh } = useDemoInventory()
  const [query, setQuery] = useState("")
  const [visibleRows, setVisibleRows] = useState(15)
  const [productToDelete, setProductToDelete] = useState<InventoryProduct | null>(null)
  const [deleting, setDeleting] = useState(false)

  const variants = useMemo(
    () => (inventory?.products ?? []).flatMap((product) =>
      product.variants.map((variant) => ({ product, variant })),
    ),
    [inventory],
  )
  const filteredVariants = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    if (!search) return variants
    return variants.filter(({ product, variant }) =>
      `${product.name} ${product.sku} ${product.category} ${product.gender} ${variant.color} ${variant.size} ${variant.barcode}`
        .toLocaleLowerCase()
        .includes(search))
  }, [query, variants])
  const filteredProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    if (!search) return inventory?.products ?? []
    return (inventory?.products ?? []).filter((product) =>
      `${product.name} ${product.sku} ${product.category} ${product.gender}`
        .toLocaleLowerCase()
        .includes(search))
  }, [inventory, query])

  const totalStock = variants.reduce(
    (sum, { variant }) => sum + sumStock(variant.stockByWarehouse),
    0,
  )
  const reservations = inventory?.reservedByVariant ?? {}
  const totalReserved = Object.values(reservations).reduce((sum, amount) => sum + amount, 0)
  const lowStockVariants = variants.filter(({ variant }) => {
    const available = Math.max(0, sumStock(variant.stockByWarehouse) - (reservations[variant.id] ?? 0))
    return available <= variant.minStock
  })

  async function confirmDelete() {
    if (!productToDelete) return
    setDeleting(true)
    try {
      await deleteSupabaseProduct(companyId, productToDelete.id)
      await refresh()
      toast.success(`Se eliminó ${productToDelete.name}.`)
      setProductToDelete(null)
    } catch (caught) {
      toast.error(caught instanceof Error
        ? caught.message
        : "No se pudo eliminar el producto.")
    } finally {
      setDeleting(false)
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm">
        <h1 className="font-semibold">No se pudo cargar el inventario</h1>
        <p className="mt-1 text-muted-foreground">{error}</p>
      </div>
    )
  }
  if (!inventory) return <p className="text-sm text-muted-foreground">Cargando inventario…</p>

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Operación / Módulos</p>
          <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de productos, variantes, existencias y reservas de pedidos.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/inventory/new" />}>
          <PlusIcon data-icon="inline-start" /> Crear producto
        </Button>
      </header>

      <section aria-label="Resumen de inventario" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Productos" value={String(inventory.products.length)} detail="Productos en catálogo" />
        <MetricCard label="Variantes" value={String(variants.length)} detail="Combinaciones color y talla" />
        <MetricCard label="Unidades reservadas" value={String(totalReserved)} detail="Pedidos aún no entregados" />
        <MetricCard label="Stock físico" value={String(totalStock)} detail="Unidades registradas" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Alertas de stock bajo</CardTitle>
          <CardDescription>
            Se compara el disponible —stock físico menos reservas— con el mínimo de cada variante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lowStockVariants.length ? (
            <div className="flex flex-wrap gap-2">
              {lowStockVariants.map(({ product, variant }) => {
                const physical = sumStock(variant.stockByWarehouse)
                const reserved = reservations[variant.id] ?? 0
                const available = Math.max(0, physical - reserved)
                return (
                  <Badge key={variant.id} variant="destructive">
                    {product.name} · {variant.color} · {variant.size}: {available} disponibles
                  </Badge>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay variantes por debajo del stock mínimo.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Existencias por variante</CardTitle>
              <CardDescription>
                El stock inicial de cada variante se registra al crear el producto.
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar productos y variantes"
                className="pl-9"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setVisibleRows(15)
                }}
                placeholder="Buscar producto, SKU, color o talla"
                value={query}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Existencias</TableHead>
                  <TableHead>Reservado</TableHead>
                  <TableHead>Disponible</TableHead>
                  <TableHead>Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVariants.slice(0, visibleRows).map(({ product, variant }) => {
                  const physical = sumStock(variant.stockByWarehouse)
                  const reserved = reservations[variant.id] ?? 0
                  const available = Math.max(0, physical - reserved)
                  const low = available <= variant.minStock
                  return (
                    <TableRow key={variant.id}>
                      <TableCell>
                        <span className="font-medium">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">{product.sku}</span>
                      </TableCell>
                      <TableCell>{variant.color} · {variant.size}</TableCell>
                      <TableCell>{physical}</TableCell>
                      <TableCell>{reserved}</TableCell>
                      <TableCell className="font-medium">{available}</TableCell>
                      <TableCell>{variant.minStock}</TableCell>
                      <TableCell>
                        <Badge variant={low ? "destructive" : "secondary"}>
                          {low ? "Stock bajo" : "Disponible"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredVariants.length === 0 && (
                  <TableRow>
                    <TableCell className="h-20 text-center text-muted-foreground" colSpan={7}>
                      {variants.length ? "No hay variantes que coincidan con la búsqueda." : "Aún no hay productos. Crea el primero para comenzar."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {visibleRows < filteredVariants.length && (
            <Button onClick={() => setVisibleRows((count) => count + 15)} variant="outline">
              Mostrar más variantes
            </Button>
          )}

          <div className="space-y-3 border-t pt-5">
            <div>
              <h2 className="font-semibold">Catálogo de productos</h2>
              <p className="text-sm text-muted-foreground">Edita la ficha o elimina productos sin historial asociado.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Variantes</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <span className="font-medium">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">{product.sku} · {product.category}</span>
                      </TableCell>
                      <TableCell>{product.variants.length}</TableCell>
                      <TableCell>{formatCurrency(product.price)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button nativeButton={false} render={<Link href={`/dashboard/inventory/${product.id}/edit`} />} size="sm" variant="outline">
                            <PencilIcon data-icon="inline-start" /> Editar
                          </Button>
                          <Button
                            aria-label={`Eliminar ${product.name}`}
                            onClick={() => setProductToDelete(product)}
                            size="icon-sm"
                            variant="destructive"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProducts.length === 0 && (
                    <TableRow>
                      <TableCell className="h-16 text-center text-muted-foreground" colSpan={4}>
                        No hay productos para mostrar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(productToDelete)} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar producto</DialogTitle>
            <DialogDescription>
              ¿Eliminar {productToDelete?.name} y sus variantes? No se puede eliminar si el producto tiene pedidos o movimientos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleting} onClick={() => setProductToDelete(null)} variant="outline">
              Cancelar
            </Button>
            <Button disabled={deleting} onClick={() => void confirmDelete()} variant="destructive">
              {deleting ? "Eliminando…" : "Eliminar producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function sumStock(stock: Record<string, number>) {
  return Object.values(stock).reduce((sum, amount) => sum + amount, 0)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}
