"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRightIcon,
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
        <section className="relative isolate overflow-hidden rounded-2xl bg-slate-900 px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_30%,rgba(220,38,38,0.5),transparent_45%),linear-gradient(120deg,#111827,#334155)]" />
          <div className="max-w-2xl space-y-5">
            <Badge className="border-white/20 bg-white/10 text-white" variant="outline">
              Inventario Frenesi Sport
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Prendas para cada equipo y cada temporada.
            </h1>
            <p className="max-w-xl text-sm text-slate-200 sm:text-base">
              Explora nuestro catálogo organizado por colección, categoría y tipo de prenda.
              Consulta tallas y existencias actualizadas.
            </p>
            <Button
              className="bg-white text-slate-950 hover:bg-slate-100"
              onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explorar catálogo <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </section>

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

          <div className="grid items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
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
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredProducts.map((product) => {
                        const availableQuantity = product.variants.reduce(
                          (total, variant) => total + variant.available,
                          0,
                        )
                        return (
                          <Card className="overflow-hidden border-slate-200 bg-white" key={[
                            product.catalog_year,
                            product.product_name,
                            product.category,
                            product.subcategory,
                          ].join("-")}>
                            <div className="relative aspect-[4/3] bg-slate-100">
                              {product.image_url ? (
                                <Image
                                  alt={product.product_name}
                                  className="object-contain p-4"
                                  fill
                                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 40vw, 100vw"
                                  src={product.image_url}
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                                  <ShirtIcon className="size-14" />
                                  <span className="text-xs">Imagen no disponible</span>
                                </div>
                              )}
                            </div>
                            <CardContent className="space-y-3 p-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h3 className="truncate text-sm font-semibold">{product.product_name}</h3>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {product.catalog_year} · {displayTaxonomy(product.category)} ·{" "}
                                    {getSubcategoryLabel(product.category ?? "all", product.subcategory ?? "")}
                                  </p>
                                </div>
                                <Badge variant={availableQuantity > 0 ? "secondary" : "outline"}>
                                  {availableQuantity > 0 ? "Disponible" : "Agotado"}
                                </Badge>
                              </div>
                              <div className="space-y-2 border-t pt-3">
                                {[...new Set(product.variants.map((variant) => variant.color))].map((color) => {
                                  const colorVariants = product.variants.filter((variant) => variant.color === color)
                                  return (
                                    <div className="flex items-center justify-between gap-2 text-xs" key={color}>
                                      <span className="truncate font-medium">{color}</span>
                                      <div className="flex flex-wrap justify-end gap-1">
                                        {colorVariants.map((variant) => (
                                          <span
                                            className={`rounded-full px-2 py-0.5 ${
                                              variant.available > 0
                                                ? "bg-slate-100 text-slate-700"
                                                : "bg-slate-50 text-slate-400"
                                            }`}
                                            key={`${variant.color}-${variant.size}`}
                                            title={`${variant.available} disponibles`}
                                          >
                                            {variant.size}
                                            {variant.available > 0 && (
                                              <span className="ml-1 tabular-nums">· {variant.available}</span>
                                            )}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
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
        </section>
      </div>
    </main>
  )
}
