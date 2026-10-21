"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowDownUpIcon, EyeIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
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
import { getSubcategoryLabel } from "@/lib/inventory/catalog-structure"
import { deleteSupabaseProduct, useDemoInventory } from "@/lib/inventory/use-demo-inventory"
import { InventoryStockAdjustment } from "@/components/inventory/inventory-stock-adjustment"
import { InventoryReferenceStockBatch } from "@/components/inventory/inventory-reference-stock-batch"

export function InventoryManager() {
  const { companyId } = useOrdersOperator()
  const { inventory, error, refresh } = useDemoInventory()
  const [query, setQuery] = useState("")
  const [visibleRows, setVisibleRows] = useState(15)
  const [visibleMovements, setVisibleMovements] = useState(10)
  const [familyFilter, setFamilyFilter] = useState("all")
  const [subcategoryFilter, setSubcategoryFilter] = useState("all")
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [catalogYearFilter, setCatalogYearFilter] = useState("all")
  const [productToDelete, setProductToDelete] = useState<InventoryProduct | null>(null)
  const [productToInspect, setProductToInspect] = useState<InventoryProduct | null>(null)
  const [productForBatchAdjustment, setProductForBatchAdjustment] = useState<InventoryProduct | null>(null)
  const [variantToAdjust, setVariantToAdjust] = useState<{
    product: InventoryProduct
    variant: InventoryProduct["variants"][number]
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const variants = useMemo(
    () => (inventory?.products ?? []).flatMap((product) =>
      product.variants.map((variant) => ({ product, variant })),
    ),
    [inventory],
  )
  const filteredProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase()
    const warehouseName = inventory?.warehouses?.find(
      (warehouse) => warehouse.id === warehouseFilter,
    )?.name
    return (inventory?.products ?? []).filter((product) => {
      const matchesSearch = !search
        || `${product.name} ${product.sku} ${product.catalogYear} ${product.category} ${product.subcategory} ${product.gender} ${product.variants.map((variant) => `${variant.color} ${variant.size} ${variant.barcode}`).join(" ")}`
          .toLocaleLowerCase()
          .includes(search)
      return matchesSearch
        && (familyFilter === "all" || product.category === familyFilter)
        && (subcategoryFilter === "all" || product.subcategory === subcategoryFilter)
        && (catalogYearFilter === "all" || String(product.catalogYear) === catalogYearFilter)
        && (warehouseFilter === "all" || Boolean(warehouseName
          && product.variants.some((variant) => warehouseName in variant.stockByWarehouse)))
    })
  }, [catalogYearFilter, familyFilter, inventory, query, subcategoryFilter, warehouseFilter])
  const pagedProducts = filteredProducts.slice(0, visibleRows)
  const catalogGroups = useMemo(() => {
    const groups = new Map<string, {
      year: number
      family: string
      subcategory: string
      products: InventoryProduct[]
    }>()

    for (const product of pagedProducts) {
      const key = `${product.catalogYear}-${product.category}-${product.subcategory}`
      const group = groups.get(key) ?? {
        year: product.catalogYear,
        family: product.category,
        subcategory: product.subcategory,
        products: [],
      }
      group.products.push(product)
      groups.set(key, group)
    }

    return [...groups.values()].sort((left, right) =>
      right.year - left.year
      || left.family.localeCompare(right.family, "es")
      || left.subcategory.localeCompare(right.subcategory, "es"))
  }, [pagedProducts])

  const totalStock = variants.reduce(
    (sum, { variant }) => sum + sumStock(variant.stockByWarehouse),
    0,
  )
  const reservations = inventory?.reservedByVariant ?? {}
  const warehouseReservations = inventory?.reservedByVariantWarehouse ?? {}
  const selectedWarehouseName = inventory?.warehouses?.find(
    (warehouse) => warehouse.id === warehouseFilter,
  )?.name
  const totalReserved = Object.values(reservations).reduce((sum, amount) => sum + amount, 0)
  const lowStockVariants = variants.filter(({ variant }) => {
    const available = Math.max(0, sumStock(variant.stockByWarehouse) - (reservations[variant.id] ?? 0))
    return available <= variant.minStock
  })
  const availableFamilies = [...new Set((inventory?.products ?? []).map((product) => product.category))]
  const availableSubcategories = [...new Set((inventory?.products ?? [])
    .filter((product) => familyFilter === "all" || product.category === familyFilter)
    .map((product) => product.subcategory))]
  const availableCatalogYears = [...new Set((inventory?.products ?? []).map((product) => product.catalogYear))]

  function setCatalogFilter(setter: (value: string) => void, value: string | null) {
    setter(value ?? "all")
    setVisibleRows(15)
    setVisibleMovements(10)
  }

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
  if (!inventory) {
    return (
      <div aria-label="Cargando inventario" className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-28" key={index} />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Año de catálogo"
              value={catalogYearFilter}
              onValueChange={(value) => setCatalogFilter(setCatalogYearFilter, value)}
            >
              <SelectItem value="all">Todos los años</SelectItem>
              {availableCatalogYears.sort((a, b) => b - a).map((year) => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Familia"
              value={familyFilter}
              onValueChange={(value) => {
                setCatalogFilter(setFamilyFilter, value)
                setSubcategoryFilter("all")
              }}
            >
              <SelectItem value="all">Todas las familias</SelectItem>
              {availableFamilies.map((family) => (
                <SelectItem key={family} value={family}>{family}</SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Categoría"
              value={subcategoryFilter}
              onValueChange={(value) => setCatalogFilter(setSubcategoryFilter, value)}
            >
              <SelectItem value="all">Todas las categorías</SelectItem>
              {availableSubcategories.map((subcategory) => (
                <SelectItem key={subcategory} value={subcategory}>
                  {getSubcategoryLabel(familyFilter, subcategory)}
                </SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Bodega"
              value={warehouseFilter}
              onValueChange={(value) => setCatalogFilter(setWarehouseFilter, value)}
            >
              <SelectItem value="all">Todas las bodegas</SelectItem>
              {(inventory.warehouses ?? []).map((warehouse) => (
                <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
              ))}
            </FilterSelect>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Tallas disponibles</TableHead>
                  <TableHead>Colores</TableHead>
                  <TableHead>Stock físico</TableHead>
                  <TableHead>Reservado</TableHead>
                  <TableHead>Disponible</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedProducts.map((product) => {
                  const productVariants = product.variants
                  const sizes = [...new Set(productVariants
                    .filter((variant) => {
                      const physical = warehouseFilter === "all"
                        ? sumStock(variant.stockByWarehouse)
                        : variant.stockByWarehouse[selectedWarehouseName ?? ""] ?? 0
                      const reserved = warehouseFilter === "all"
                        ? reservations[variant.id] ?? 0
                        : warehouseReservations[variant.id]?.[warehouseFilter] ?? 0
                      return physical - reserved > 0
                    })
                    .map((variant) => variant.size))]
                    .sort(compareSizes)
                  const colors = [...new Set(productVariants.map((variant) => variant.color))]
                  const physical = productVariants.reduce((sum, variant) =>
                    sum + (warehouseFilter === "all"
                      ? sumStock(variant.stockByWarehouse)
                      : variant.stockByWarehouse[selectedWarehouseName ?? ""] ?? 0), 0)
                  const reserved = productVariants.reduce((sum, variant) =>
                    sum + (warehouseFilter === "all"
                      ? reservations[variant.id] ?? 0
                      : warehouseReservations[variant.id]?.[warehouseFilter] ?? 0), 0)
                  const available = Math.max(0, physical - reserved)
                  const lowCount = productVariants.filter((variant) => {
                    const variantPhysical = warehouseFilter === "all"
                      ? sumStock(variant.stockByWarehouse)
                      : variant.stockByWarehouse[selectedWarehouseName ?? ""] ?? 0
                    const variantReserved = warehouseFilter === "all"
                      ? reservations[variant.id] ?? 0
                      : warehouseReservations[variant.id]?.[warehouseFilter] ?? 0
                    return Math.max(0, variantPhysical - variantReserved) <= variant.minStock
                  }).length
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <span className="font-medium">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">{product.sku}</span>
                      </TableCell>
                      <TableCell>
                        {sizes.length ? (
                          <div className="flex max-w-64 flex-wrap gap-1">
                            {sizes.map((size) => <Badge key={size} variant="outline">{size}</Badge>)}
                          </div>
                        ) : <span className="text-muted-foreground">Sin tallas disponibles</span>}
                      </TableCell>
                      <TableCell>{colors.join(", ") || "—"}</TableCell>
                      <TableCell>{physical}</TableCell>
                      <TableCell>{reserved}</TableCell>
                      <TableCell className="font-medium">{available}</TableCell>
                      <TableCell>
                        <Badge variant={lowCount ? "destructive" : "secondary"}>
                          {lowCount ? `${lowCount} variantes con stock bajo` : "Disponible"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          onClick={() => setProductToInspect(product)}
                          size="sm"
                          variant="outline"
                        >
                          <EyeIcon data-icon="inline-start" /> Ver referencia
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell className="h-20 text-center text-muted-foreground" colSpan={8}>
                      {variants.length ? "No hay variantes que coincidan con la búsqueda." : "Aún no hay productos. Crea el primero para comenzar."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {visibleRows < filteredProducts.length && (
            <Button onClick={() => setVisibleRows((count) => count + 15)} variant="outline">
              Mostrar más productos
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
                  {catalogGroups.flatMap((group) => [
                    <TableRow className="bg-muted/50" key={`group-${group.year}-${group.family}-${group.subcategory}`}>
                      <TableCell className="font-medium" colSpan={4}>
                        Catálogo {group.year} / {group.family} / {getSubcategoryLabel(group.family, group.subcategory)}
                      </TableCell>
                    </TableRow>,
                    ...group.products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <span className="font-medium">{product.name}</span>
                          <span className="block text-xs text-muted-foreground">{product.sku}</span>
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
                    )),
                  ])}
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
            {visibleRows < filteredProducts.length && (
              <Button onClick={() => setVisibleRows((count) => count + 15)} variant="outline">
                Mostrar más productos
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos y reservas</CardTitle>
          <CardDescription>
            Kardex reciente de entradas, salidas y reservas activas de pedidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto / variante</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Referencia / razón</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.movements.slice(0, visibleMovements).map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Intl.DateTimeFormat("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(movement.date))}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{movement.productName}</span>
                      <span className="block text-xs text-muted-foreground">{movement.variantName}</span>
                    </TableCell>
                    <TableCell>{movement.warehouse}</TableCell>
                    <TableCell>
                      <Badge variant={movement.type === "Salida"
                        ? "destructive"
                        : movement.type === "Reserva" ? "outline" : "secondary"}>
                        {movement.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {movement.type === "Reserva"
                        ? "1 reservada"
                        : `${movement.quantity > 0 ? "+" : ""}${movement.quantity}`}
                    </TableCell>
                    <TableCell>
                      <span>{movement.reference || "—"}</span>
                      <span className="block max-w-64 truncate text-xs text-muted-foreground" title={movement.note}>
                        {movement.note || "—"}
                      </span>
                    </TableCell>
                    <TableCell title={movement.userId ?? "Acción de sistema"}>
                      {movement.userId ? `Usuario ${movement.userId.slice(0, 8)}` : "Sistema / pedido"}
                    </TableCell>
                  </TableRow>
                ))}
                {inventory.movements.length === 0 && (
                  <TableRow>
                    <TableCell className="h-20 text-center text-muted-foreground" colSpan={7}>
                      No hay movimientos ni reservas activas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {visibleMovements < inventory.movements.length && (
            <Button onClick={() => setVisibleMovements((count) => count + 10)} variant="outline">
              Mostrar más movimientos
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(productToInspect)}
        onOpenChange={(open) => !open && setProductToInspect(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de referencia</DialogTitle>
            <DialogDescription>
              {productToInspect
                ? `${productToInspect.name} · SKU ${productToInspect.sku} · ${productToInspect.variants.length} variantes`
                : "Variantes disponibles por color y talla."}
            </DialogDescription>
          </DialogHeader>
          {productToInspect && (
            <>
              <div className="flex justify-end">
                <Button
                  disabled={!inventory.warehouses?.length}
                  onClick={() => {
                    setProductForBatchAdjustment(productToInspect)
                    setProductToInspect(null)
                  }}
                >
                  <ArrowDownUpIcon data-icon="inline-start" /> Agregar unidades por talla/color
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Color</TableHead>
                      <TableHead>Talla</TableHead>
                      <TableHead>Stock físico</TableHead>
                      <TableHead>Reservado</TableHead>
                      <TableHead>Disponible</TableHead>
                      <TableHead>Mínimo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...productToInspect.variants]
                      .sort((left, right) =>
                        left.color.localeCompare(right.color, "es")
                        || compareSizes(left.size, right.size))
                      .map((variant) => {
                        const physical = warehouseFilter === "all"
                          ? sumStock(variant.stockByWarehouse)
                          : variant.stockByWarehouse[selectedWarehouseName ?? ""] ?? 0
                        const reserved = warehouseFilter === "all"
                          ? reservations[variant.id] ?? 0
                          : warehouseReservations[variant.id]?.[warehouseFilter] ?? 0
                        const available = Math.max(0, physical - reserved)
                        const low = available <= variant.minStock
                        return (
                          <TableRow key={variant.id}>
                            <TableCell>{variant.color}</TableCell>
                            <TableCell><Badge variant="outline">{variant.size}</Badge></TableCell>
                            <TableCell>{physical}</TableCell>
                            <TableCell>{reserved}</TableCell>
                            <TableCell className="font-medium">{available}</TableCell>
                            <TableCell>{variant.minStock}</TableCell>
                            <TableCell>
                              <Badge variant={low ? "destructive" : "secondary"}>
                                {low ? "Stock bajo" : "Disponible"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                disabled={!inventory.warehouses?.length}
                                onClick={() => {
                                  setVariantToAdjust({ product: productToInspect, variant })
                                  setProductToInspect(null)
                                }}
                                size="sm"
                                variant="outline"
                              >
                                <ArrowDownUpIcon data-icon="inline-start" /> Ajustar
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <InventoryReferenceStockBatch
        companyId={companyId}
        defaultWarehouse={selectedWarehouseName}
        key={`${productForBatchAdjustment?.id ?? "closed"}-${selectedWarehouseName ?? ""}`}
        onClose={() => setProductForBatchAdjustment(null)}
        onSaved={refresh}
        product={productForBatchAdjustment}
        warehouses={inventory.warehouses ?? []}
      />

      <InventoryStockAdjustment
        companyId={companyId}
        key={variantToAdjust?.variant.id ?? "closed-stock-adjustment"}
        onClose={() => setVariantToAdjust(null)}
        onSaved={refresh}
        preferredWarehouse={selectedWarehouseName}
        product={variantToAdjust?.product ?? null}
        variant={variantToAdjust?.variant ?? null}
        warehouses={inventory.warehouses ?? []}
      />

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

function compareSizes(left: string, right: string) {
  const sizeOrder = ["4", "6", "8", "10", "12", "14", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]
  const leftIndex = sizeOrder.indexOf(left.toUpperCase())
  const rightIndex = sizeOrder.indexOf(right.toUpperCase())
  if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex
  if (leftIndex !== -1) return -1
  if (rightIndex !== -1) return 1
  return left.localeCompare(right, "es", { numeric: true })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

function FilterSelect({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string
  value: string
  onValueChange: (value: string | null) => void
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  )
}
