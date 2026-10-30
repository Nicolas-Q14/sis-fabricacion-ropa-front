"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ChevronDownIcon,
  FolderIcon,
  GalleryVerticalEndIcon,
  RefreshCwIcon,
  SearchIcon,
  ShirtIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  getSubcategoryLabel,
  INVENTORY_FAMILIES,
  type InventoryFamily,
} from "@/lib/inventory/catalog-structure"
import { createClient } from "@/lib/supabase/client"
import {
  PublicCatalogBanner,
  PublicCatalogCarousel,
  PublicCatalogFooter,
} from "@/components/inventory/public-catalog-marketing"
import { usePublicCatalogMarketing } from "@/lib/inventory/use-public-catalog-marketing"

type PublicInventoryRow = {
  catalog_year: number
  product_name: string
  category: string | null
  subcategory: string | null
  product_gender: string | null
  image_url: string | null
  color: string
  size: string
  available_quantity: number
}

type PublicProduct = Omit<PublicInventoryRow, "color" | "size" | "available_quantity"> & {
  variants: { color: string; size: string; available: number }[]
}

type FolderSelection =
  | { kind: "all" }
  | { kind: "year"; year: number }
  | { kind: "family"; year: number; family: string }
  | { kind: "subcategory"; year: number; family: string; subcategory: string }
  | { kind: "gallery" }

const knownYears = [2024, 2025, 2026]
const familyLabels = Object.keys(INVENTORY_FAMILIES) as InventoryFamily[]

function folderKey(folder: FolderSelection) {
  return folder.kind === "all" || folder.kind === "gallery"
    ? folder.kind
    : folder.kind === "year"
      ? `year:${folder.year}`
      : folder.kind === "family"
        ? `family:${folder.year}:${folder.family}`
        : `subcategory:${folder.year}:${folder.family}:${folder.subcategory}`
}

function displayTaxonomy(value: string | null) {
  if (!value) return "Sin categoría"
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("es"))
}

function combineVariants(rows: PublicInventoryRow[]): PublicProduct[] {
  const products = new Map<string, PublicProduct>()
  for (const row of rows) {
    const key = [
      row.catalog_year,
      row.product_name,
      row.category,
      row.subcategory,
      row.product_gender,
      row.image_url,
    ].join("::")
    const product = products.get(key) ?? {
      catalog_year: row.catalog_year,
      product_name: row.product_name,
      category: row.category,
      subcategory: row.subcategory,
      product_gender: row.product_gender,
      image_url: row.image_url,
      variants: [],
    }
    product.variants.push({
      color: row.color,
      size: row.size,
      available: row.available_quantity,
    })
    products.set(key, product)
  }
  return [...products.values()].sort((left, right) =>
    left.product_name.localeCompare(right.product_name, "es"),
  )
}

function matchesFolder(product: PublicProduct, folder: FolderSelection) {
  if (folder.kind === "all") return true
  if (folder.kind === "gallery") return false
  if (product.catalog_year !== folder.year) return false
  if (folder.kind === "year") return true
  if ((product.category ?? "Textiles") !== folder.family) return false
  return folder.kind === "family" || product.subcategory === folder.subcategory
}

export function PublicInventory() {
  const [inventory, setInventory] = useState<PublicInventoryRow[]>([])
  const [search, setSearch] = useState("")
  const [availableOnly, setAvailableOnly] = useState(false)
  const [folder, setFolder] = useState<FolderSelection>({ kind: "all" })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const { banner, slides, footer } = usePublicCatalogMarketing(false)

  const loadInventory = useCallback(() => {
    const supabase = createClient()
    void Promise.resolve()
      .then(() => supabase.rpc("get_public_inventory"))
      .then(({ data, error: requestError }) => {
        if (requestError) throw new Error(requestError.message)
        setInventory((data ?? []) as PublicInventoryRow[])
        setUpdatedAt(new Date())
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error
          ? caught.message
          : "No se pudo cargar el inventario actual.")
      })
      .finally(() => setLoading(false))
  }, [])

  function refreshInventory() {
    setLoading(true)
    setError("")
    loadInventory()
  }

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  const products = useMemo(() => combineVariants(inventory), [inventory])
  const years = [...new Set([...knownYears, ...products.map((product) => product.catalog_year)])]
    .sort((left, right) => right - left)
  const normalizedSearch = search.trim().toLocaleLowerCase("es")
  const filteredProducts = products.filter((product) => {
    const matchesText = !normalizedSearch || [
      product.product_name,
      product.category,
      product.subcategory,
      product.product_gender,
      ...product.variants.flatMap((variant) => [variant.color, variant.size]),
    ].join(" ").toLocaleLowerCase("es").includes(normalizedSearch)
    const matchesAvailability = !availableOnly
      || product.variants.some((variant) => variant.available > 0)
    return matchesFolder(product, folder) && matchesText && matchesAvailability
  })
  const totalAvailable = inventory.reduce((total, item) => total + item.available_quantity, 0)
  const selectedFolder = folderKey(folder)
  const isGallerySelected = folder.kind === "gallery"

  function selectFolder(next: FolderSelection) {
    setFolder(next)
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <main className="min-h-svh bg-[#f7f8fa] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link className="flex items-center gap-2 font-semibold" href="/inventario">
            <span className="flex size-9 items-center justify-center rounded-lg bg-red-600 text-white">
              <ShirtIcon className="size-5" />
            </span>
            <span>Frenesi Sport</span>
          </Link>
          <Button nativeButton={false} render={<Link href="/login" />} size="sm" variant="outline">
            Acceso al equipo
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <PublicCatalogBanner banner={banner} />

        <section className="space-y-5" id="catalog">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">Catálogo</h2>
              <p className="text-sm text-muted-foreground">
                Descubre las prendas disponibles organizadas como carpetas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span>{products.length} productos</span>
              <span aria-hidden="true">·</span>
              <span>{totalAvailable} unidades disponibles</span>
            </div>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
            <Card className="overflow-visible">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FolderIcon className="size-4 text-amber-500" />
                  inventario Frenesi Sport
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-2 pb-3">
                <button
                  aria-current={selectedFolder === "all" ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    selectedFolder === "all" ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                  }`}
                  onClick={() => selectFolder({ kind: "all" })}
                  type="button"
                >
                  <FolderIcon className="size-4 text-amber-500" /> Todos los catálogos
                </button>
                <details className="group" open>
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-0 -rotate-90" />
                    <FolderIcon className="size-4 text-amber-500" /> catalogos
                  </summary>
                  <div className="ml-3 border-l pl-2">
                    {years.map((year) => (
                      <details className="group" key={year}>
                        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                          <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-0 -rotate-90" />
                          <FolderIcon className="size-4 text-amber-500" /> {year}
                        </summary>
                        <button
                          aria-current={selectedFolder === folderKey({ kind: "year", year }) ? "page" : undefined}
                          className={`ml-7 flex w-[calc(100%-1.75rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                            selectedFolder === folderKey({ kind: "year", year })
                              ? "bg-primary/10 font-medium text-primary"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => selectFolder({ kind: "year", year })}
                          type="button"
                        >
                          <FolderIcon className="size-3.5 text-amber-500" /> Ver todo {year}
                        </button>
                        <div className="ml-3 border-l pl-2">
                          {familyLabels.map((family) => (
                            <details className="group" key={`${year}-${family}`}>
                              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                                <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-0 -rotate-90" />
                                <FolderIcon className="size-4 text-amber-500" />
                                {family.toLocaleLowerCase("es")}
                              </summary>
                              <button
                                aria-current={selectedFolder === folderKey({ kind: "family", year, family })
                                  ? "page"
                                  : undefined}
                                className={`ml-7 flex w-[calc(100%-1.75rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                                  selectedFolder === folderKey({ kind: "family", year, family })
                                    ? "bg-primary/10 font-medium text-primary"
                                    : "hover:bg-muted"
                                }`}
                                onClick={() => selectFolder({ kind: "family", year, family })}
                                type="button"
                              >
                                <FolderIcon className="size-3.5 text-amber-500" /> Ver todos
                              </button>
                              <div className="ml-3 border-l pl-2">
                                {INVENTORY_FAMILIES[family].map((subcategory) => {
                                  const selection: FolderSelection = {
                                    kind: "subcategory",
                                    year,
                                    family,
                                    subcategory: subcategory.value,
                                  }
                                  const selected = selectedFolder === folderKey(selection)
                                  return (
                                    <button
                                      aria-current={selected ? "page" : undefined}
                                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                                        selected ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                                      }`}
                                      key={subcategory.value}
                                      onClick={() => selectFolder(selection)}
                                      type="button"
                                    >
                                      <FolderIcon className="size-3.5 shrink-0 text-amber-500" />
                                      <span className="truncate">{subcategory.value}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <ChevronDownIcon className="size-3.5 transition-transform group-open:rotate-0 -rotate-90" />
                    <FolderIcon className="size-4 text-amber-500" /> galeria
                  </summary>
                  <button
                    aria-current={isGallerySelected ? "page" : undefined}
                    className={`ml-7 flex w-[calc(100%-1.75rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                      isGallerySelected ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                    }`}
                    onClick={() => selectFolder({ kind: "gallery" })}
                    type="button"
                  >
                    <GalleryVerticalEndIcon className="size-3.5 text-amber-500" />
                    trabajos_entregados
                  </button>
                </details>
              </CardContent>
            </Card>

            <div className="min-w-0 space-y-4">
              {!isGallerySelected ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="relative min-w-0 flex-1">
                      <span className="sr-only">Buscar productos</span>
                      <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-10 bg-white pl-9"
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar prenda, color o talla"
                        value={search}
                      />
                    </label>
                    <Button
                      aria-pressed={availableOnly}
                      onClick={() => setAvailableOnly((current) => !current)}
                      variant={availableOnly ? "secondary" : "outline"}
                    >
                      {availableOnly ? "Solo disponibles" : "Todas las existencias"}
                    </Button>
                    <Button disabled={loading} onClick={refreshInventory} variant="outline">
                      <RefreshCwIcon data-icon="inline-start" /> Actualizar
                    </Button>
                  </div>
                  <div aria-live="polite" className="text-xs text-muted-foreground">
                    {loading
                      ? "Actualizando inventario…"
                      : `${filteredProducts.length} productos en esta carpeta${updatedAt
                        ? ` · Actualizado ${updatedAt.toLocaleTimeString("es-CO", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : ""}`}
                  </div>

                  {error ? (
                    <Card className="border-destructive/40">
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <p className="text-sm text-destructive" role="alert">
                          No se pudo cargar el inventario. {error}
                        </p>
                        <Button disabled={loading} onClick={refreshInventory} variant="outline">
                          Reintentar
                        </Button>
                      </CardContent>
                    </Card>
                  ) : loading && inventory.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Cargando catálogo…
                    </p>
                  ) : filteredProducts.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-sm text-muted-foreground">
                        {inventory.length === 0
                          ? "Aún no hay productos publicados en el inventario."
                          : "No hay productos en esta carpeta que coincidan con la búsqueda."}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {filteredProducts.map((product) => {
                        const availableQuantity = product.variants.reduce(
                          (total, variant) => total + variant.available,
                          0,
                        )
                        const colors = [...new Set(product.variants.map((variant) => variant.color))]
                        const sizes = [...new Set(product.variants.map((variant) => variant.size))]
                        return (
                          <Card className="group overflow-hidden rounded-xl border-slate-200/80 bg-white py-0 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" key={[
                            product.catalog_year,
                            product.product_name,
                            product.category,
                            product.subcategory,
                          ].join("-")}>
                            <div className="relative aspect-[1.08/1] bg-[#f0f2f5]">
                              {product.image_url ? (
                                <Image
                                  alt={product.product_name}
                                  className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03] sm:p-4"
                                  fill
                                  sizes="(min-width: 1280px) 20vw, (min-width: 640px) 45vw, 100vw"
                                  src={product.image_url}
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                                  <ShirtIcon className="size-14" />
                                  <span className="text-xs">Imagen no disponible</span>
                                </div>
                              )}
                              <Badge
                                className={`absolute right-2 bottom-2 border-0 px-2 py-0.5 text-[10px] shadow-sm ${
                                  availableQuantity > 0
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`mr-1 size-1.5 rounded-full ${
                                    availableQuantity > 0 ? "bg-emerald-500" : "bg-slate-400"
                                  }`}
                                />
                                {availableQuantity > 0 ? "Disponible" : "Agotado"}
                              </Badge>
                            </div>
                            <CardContent className="space-y-2.5 p-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-xs font-semibold sm:text-sm">
                                  {product.product_name}
                                </h3>
                                <p className="mt-1 truncate text-[10px] text-muted-foreground">
                                  {product.catalog_year} · {displayTaxonomy(product.category)} ·{" "}
                                  {getSubcategoryLabel(product.category ?? "all", product.subcategory ?? "")}
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                                <div aria-label={`Colores: ${colors.join(", ")}`} className="flex -space-x-1">
                                  {colors.map((color) => (
                                    <span
                                      aria-hidden="true"
                                      className="size-4 rounded-full border-2 border-white shadow-sm"
                                      key={color}
                                      style={{ backgroundColor: colorSwatch(color) }}
                                      title={color}
                                    />
                                  ))}
                                </div>
                                <div aria-label="Tallas y existencias" className="flex flex-wrap justify-end gap-1">
                                  {sizes.map((size) => {
                                    const quantity = product.variants
                                      .filter((variant) => variant.size === size)
                                      .reduce((total, variant) => total + variant.available, 0)
                                    return (
                                      <span
                                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${
                                          quantity > 0
                                            ? "bg-slate-100 text-slate-600"
                                            : "bg-slate-50 text-slate-400"
                                        }`}
                                        key={size}
                                        title={`${quantity} disponibles para talla ${size}`}
                                      >
                                        {size}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
                    <GalleryVerticalEndIcon className="size-10 text-muted-foreground" />
                    <div className="space-y-1">
                      <h3 className="font-semibold">Trabajos entregados</h3>
                      <p className="max-w-md text-sm text-muted-foreground">
                        La carpeta de galería está lista. Aún no hay trabajos reales publicados.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          <PublicCatalogCarousel
            slides={slides}
          />
        </section>
        <PublicCatalogFooter footer={footer} />
      </div>
    </main>
  )
}

function colorSwatch(value: string) {
  const normalized = value.trim().toLocaleLowerCase("es")
  if (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(normalized)) return normalized
  const colors: Record<string, string> = {
    blanco: "#ffffff",
    "blanco hielo": "#f8fafc",
    negro: "#171717",
    "azul marino": "#1e3a8a",
    azul: "#2563eb",
    rojo: "#dc2626",
    "rojo oscuro": "#991b1b",
    verde: "#16a34a",
    amarillo: "#eab308",
    gris: "#6b7280",
    "gris oscuro": "#374151",
    naranja: "#ea580c",
    rosado: "#ec4899",
    morado: "#7c3aed",
  }
  return colors[normalized] ?? "#64748b"
}
