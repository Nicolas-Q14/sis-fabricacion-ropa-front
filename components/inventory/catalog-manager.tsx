"use client"

import Link from "next/link"
import { FolderIcon, PencilIcon, PlusIcon, ShirtIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDemoInventory } from "@/lib/inventory/use-demo-inventory"
import {
  getSubcategoryLabel,
  INVENTORY_FAMILIES,
  type InventoryFamily,
} from "@/lib/inventory/catalog-structure"
import type { InventoryProduct } from "@/lib/inventory/demo-inventory"

const familyNames = Object.keys(INVENTORY_FAMILIES) as InventoryFamily[]

export function CatalogManager() {
  const { inventory, error } = useDemoInventory()

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="py-5 text-sm text-destructive">
          No se pudo cargar el catálogo: {error}
        </CardContent>
      </Card>
    )
  }
  if (!inventory) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72" />
      </div>
    )
  }

  const years = [...new Set([2024, 2025, 2026, ...inventory.products.map((item) => item.catalogYear)])]
    .sort((left, right) => right - left)

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Administración / Catálogo público</p>
          <h1 className="text-2xl font-semibold tracking-tight">Control del catálogo</h1>
          <p className="text-sm text-muted-foreground">
            Administra productos por año, familia y categoría. Los productos activos se reflejan en la landing pública.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/catalogo/nuevo" />}>
          <PlusIcon data-icon="inline-start" /> Agregar producto
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderIcon className="size-5 text-amber-500" />
            inventario Frenesi Sport
          </CardTitle>
          <CardDescription>
            {inventory.products.length} productos · {years.length} catálogos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {years.map((year) => {
            const yearProducts = inventory.products.filter((product) => product.catalogYear === year)
            return (
              <details className="group rounded-lg border" key={year} open={year === years[0]}>
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium">
                  <FolderIcon className="size-4 text-amber-500" />
                  <span>catalogos/{year}</span>
                  <Badge className="ml-auto" variant="outline">{yearProducts.length} productos</Badge>
                </summary>
                <div className="space-y-5 border-t px-4 py-4">
                  {familyNames.map((family) => (
                    <section className="space-y-2" key={family}>
                      <h2 className="flex items-center gap-2 text-sm font-semibold">
                        <FolderIcon className="size-4 text-amber-500" />
                        productos/{family.toLocaleLowerCase("es")}
                      </h2>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {INVENTORY_FAMILIES[family].map(({ value: subcategory }) => {
                          const familyProducts = yearProducts.filter((product) =>
                            product.category === family && product.subcategory === subcategory,
                          )
                          if (familyProducts.length === 0) return null
                          return (
                            <div className="space-y-2 rounded-lg bg-muted/40 p-3" key={subcategory}>
                              <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <FolderIcon className="size-3.5 text-amber-500" />
                                {getSubcategoryLabel(family, subcategory)}
                              </p>
                              {familyProducts.map((product) => (
                                <div
                                  className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
                                  key={product.id}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <ShirtIcon className="size-4 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">{product.name}</p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {product.sku} · {getSubcategoryLabel(family, product.subcategory)}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    aria-label={`Editar ${product.name}`}
                                    nativeButton={false}
                                    render={<Link href={`/dashboard/catalogo/${encodeURIComponent(product.id)}/editar`} />}
                                    size="icon-sm"
                                    variant="outline"
                                  >
                                    <PencilIcon />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                        {yearProducts.some((product) =>
                          product.category === family
                          && !INVENTORY_FAMILIES[family].some((option) =>
                            option.value === product.subcategory),
                        ) && (
                          <ExtraProducts products={yearProducts.filter((product) =>
                            product.category === family
                            && !INVENTORY_FAMILIES[family].some((option) =>
                              option.value === product.subcategory),
                          )} />
                        )}
                      </div>
                    </section>
                  ))}
                  {yearProducts.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Carpeta vacía. Agrega un producto para publicarlo en la landing.
                    </p>
                  )}
                </div>
              </details>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function ExtraProducts({ products }: { products: InventoryProduct[] }) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FolderIcon className="size-3.5 text-amber-500" /> otras categorías
      </p>
      {products.map((product) => (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-background p-3" key={product.id}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">{product.sku} · {product.subcategory}</p>
          </div>
          <Button
            aria-label={`Editar ${product.name}`}
            nativeButton={false}
            render={<Link href={`/dashboard/catalogo/${encodeURIComponent(product.id)}/editar`} />}
            size="icon-sm"
            variant="outline"
          >
            <PencilIcon />
          </Button>
        </div>
      ))}
    </div>
  )
}
