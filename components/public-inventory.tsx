"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRightIcon,
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  Trash2Icon,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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

type CartItem = {
  key: string
  productKey: string
  productName: string
  catalogYear: number
  color: string
  size: string
  quantity: number
  available: number
  imageUrl: string | null
}

type FolderSelection =
  | { kind: "all" }
  | { kind: "year"; year: number }
  | { kind: "family"; year: number; family: string }
  | { kind: "subcategory"; year: number; family: string; subcategory: string }
  | { kind: "gallery" }

const knownYears = [2024, 2025, 2026]
const familyLabels = Object.keys(INVENTORY_FAMILIES) as InventoryFamily[]
const featuredCategories = ["camisetas", "busos_capota", "sudaderas", "pantalonetas"]
const whatsappPhone = "573124157146"

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

function getProductKey(product: PublicProduct) {
  return [
    product.catalog_year,
    product.product_name,
    product.category,
    product.subcategory,
    product.product_gender,
    product.image_url,
  ].join("::")
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

function PublicProductCard({
  product,
  cart,
  onAddToCart,
}: {
  product: PublicProduct
  cart: CartItem[]
  onAddToCart: (product: PublicProduct, variant: PublicProduct["variants"][number]) => void
}) {
  const firstVariant = product.variants.find((variant) => variant.available > 0) ?? product.variants[0]
  const [selectedColor, setSelectedColor] = useState(firstVariant?.color ?? "")
  const [selectedSize, setSelectedSize] = useState(firstVariant?.size ?? "")
  const colors = [...new Set(product.variants.map((variant) => variant.color))]
  const activeColor = colors.includes(selectedColor) ? selectedColor : firstVariant?.color ?? ""
  const sizesForColor = product.variants.filter((variant) => variant.color === activeColor)
  const selectedVariant = sizesForColor.find((variant) => variant.size === selectedSize)
    ?? sizesForColor[0]
  const productKey = getProductKey(product)
  const selectedCartQuantity = cart
    .filter((item) => item.productKey === productKey
      && item.color === selectedVariant?.color
      && item.size === selectedVariant?.size)
    .reduce((total, item) => total + item.quantity, 0)
  const availableQuantity = product.variants.reduce(
    (total, variant) => total + variant.available,
    0,
  )

  return (
    <Card className="group overflow-hidden rounded-xl border-red-100 bg-white py-0 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:shadow-lg hover:shadow-red-950/5">
      <div className="relative aspect-[1.08/1] bg-[#fff5f5]">
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
          className={`absolute top-2 left-2 border-0 px-2 py-0.5 text-[10px] shadow-sm ${
            availableQuantity > 0
              ? "bg-white text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {availableQuantity > 0 ? "Disponible" : "Agotado"}
        </Badge>
      </div>
      <CardContent className="space-y-3 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{product.product_name}</h3>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {product.catalog_year} · {displayTaxonomy(product.category)} ·{" "}
            {getSubcategoryLabel(product.category ?? "all", product.subcategory ?? "")}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <div aria-label={`Colores: ${colors.join(", ")}`} className="flex -space-x-1">
            {colors.map((color) => (
              <span
                aria-hidden="true"
                className={`size-4 rounded-full border-2 border-white shadow-sm ${
                  selectedColor === color ? "ring-1 ring-red-600" : ""
                }`}
                key={color}
                style={{ backgroundColor: colorSwatch(color) }}
                title={color}
              />
            ))}
          </div>
          <p className="text-xs font-semibold text-red-800">Consulta el precio</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[11px] font-medium text-slate-600">
            <span>Color</span>
            <select
              aria-label={`Color de ${product.product_name}`}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
              onChange={(event) => {
                const nextColor = event.target.value
                setSelectedColor(nextColor)
                const nextVariant = product.variants.find(
                  (variant) => variant.color === nextColor && variant.available > 0,
                ) ?? product.variants.find((variant) => variant.color === nextColor)
                if (nextVariant) setSelectedSize(nextVariant.size)
              }}
              value={activeColor}
            >
              {colors.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[11px] font-medium text-slate-600">
            <span>Talla</span>
            <select
              aria-label={`Talla de ${product.product_name}`}
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
              onChange={(event) => setSelectedSize(event.target.value)}
              value={selectedVariant?.size ?? ""}
            >
              {sizesForColor.map((variant) => (
                <option disabled={variant.available <= 0} key={variant.size} value={variant.size}>
                  {variant.size}{variant.available <= 0 ? " · Agotada" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {selectedVariant?.available ?? 0} disponibles
          </span>
          <Button
            className="h-9 bg-[#b5121b] px-3 text-xs text-white hover:bg-[#920c15]"
            disabled={!selectedVariant || selectedVariant.available <= selectedCartQuantity}
            onClick={() => {
              if (selectedVariant) onAddToCart(product, selectedVariant)
            }}
            size="sm"
          >
            <ShoppingBagIcon data-icon="inline-start" />
            {selectedCartQuantity > 0 ? `En carrito (${selectedCartQuantity})` : "Agregar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function PublicInventory() {
  const [inventory, setInventory] = useState<PublicInventoryRow[]>([])
  const [search, setSearch] = useState("")
  const [availableOnly, setAvailableOnly] = useState(false)
  const [folder, setFolder] = useState<FolderSelection>({ kind: "all" })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
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
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0)
  const currentCart = cart.map((item) => {
    const product = products.find((candidate) => getProductKey(candidate) === item.productKey)
    const variant = product?.variants.find(
      (candidate) => candidate.color === item.color && candidate.size === item.size,
    )
    return { ...item, available: variant?.available ?? 0 }
  })
  const canSendOrder = currentCart.length > 0
    && currentCart.every((item) => item.quantity <= item.available)
  const orderMessage = [
    "Hola, Frenesi Sport. Quiero hacer un pedido:",
    "",
    ...currentCart.map(
      (item) => `• ${item.productName} (${item.catalogYear}) — Color: ${item.color}, talla: ${item.size}, cantidad: ${item.quantity}`,
    ),
    "",
    "Por favor, confirmen el precio y disponibilidad para continuar con la compra.",
  ].join("\n")
  const whatsappOrderUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(orderMessage)}`
  const selectedFolder = folderKey(folder)
  const isGallerySelected = folder.kind === "gallery"

  function addToCart(product: PublicProduct, variant: PublicProduct["variants"][number]) {
    if (variant.available <= 0) return
    const productKey = getProductKey(product)
    const key = `${productKey}::${variant.color}::${variant.size}`
    setCart((items) => {
      const currentItem = items.find((item) => item.key === key)
      if (currentItem && currentItem.quantity >= variant.available) return items
      if (currentItem) {
        return items.map((item) => item.key === key
          ? { ...item, quantity: item.quantity + 1, available: variant.available }
          : item)
      }
      return [...items, {
        key,
        productKey,
        productName: product.product_name,
        catalogYear: product.catalog_year,
        color: variant.color,
        size: variant.size,
        quantity: 1,
        available: variant.available,
        imageUrl: product.image_url,
      }]
    })
  }

  function changeCartQuantity(key: string, quantity: number) {
    setCart((items) => items.flatMap((item) => {
      if (item.key !== key) return [item]
      const product = products.find((candidate) => getProductKey(candidate) === item.productKey)
      const variant = product?.variants.find(
        (candidate) => candidate.color === item.color && candidate.size === item.size,
      )
      if (quantity <= 0) return []
      if (!variant || quantity > variant.available) return [item]
      return [{ ...item, quantity, available: variant.available }]
    }))
  }

  function selectFolder(next: FolderSelection) {
    setFolder(next)
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <main className="min-h-svh bg-[#fffafa] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-red-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="bg-[#a30e17] px-4 py-2 text-center text-[10px] font-semibold tracking-[0.2em] text-white sm:text-xs">
          DISEÑO PARA TU EQUIPO · ENVÍOS Y PEDIDOS POR WHATSAPP
        </div>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-6">
          <Link className="flex shrink-0 items-center gap-2 font-semibold" href="/inventario">
            <Image
              alt="Frenesi Sport"
              className="size-8 rounded-lg object-contain sm:size-10"
              height={40}
              src="/frenesi-sport-logo.png"
              width={40}
            />
            <span className="whitespace-nowrap text-base tracking-tight sm:text-lg">
              Frenesi <span className="text-red-700">Sport</span>
            </span>
          </Link>
          <nav aria-label="Navegación principal" className="flex items-center gap-2 sm:gap-5">
            <Link
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-red-700 sm:inline"
              href="#inicio"
            >
              Inicio
            </Link>
            <Link
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-red-700 sm:inline"
              href="#catalog"
            >
              Catálogo
            </Link>
            <Link
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-red-700 lg:inline"
              href="#nosotros"
            >
              Nosotros
            </Link>
            <Link
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-red-700 lg:inline"
              href="#contacto"
            >
              Contacto
            </Link>
            <Sheet onOpenChange={setIsCartOpen} open={isCartOpen}>
              <SheetTrigger
                render={
                  <Button
                    aria-label={`Abrir carrito, ${cartCount} productos`}
                    className="relative size-9 border-slate-200 text-slate-800"
                    size="icon"
                    variant="outline"
                  />
                }
              >
                <ShoppingBagIcon aria-hidden="true" />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-[#b5121b] text-[10px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </SheetTrigger>
              <SheetContent aria-describedby="cart-description" className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-xl">
                    <ShoppingBagIcon className="size-5 text-red-700" />
                    Tu carrito
                    {cartCount > 0 && (
                      <span className="text-sm font-normal text-muted-foreground">
                        ({cartCount} {cartCount === 1 ? "prenda" : "prendas"})
                      </span>
                    )}
                  </SheetTitle>
                  <SheetDescription id="cart-description">
                    Revisa las prendas y tallas antes de enviar tu pedido.
                  </SheetDescription>
                </SheetHeader>
                {currentCart.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <span className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-700">
                      <ShoppingBagIcon className="size-6" />
                    </span>
                    <h3 className="font-semibold">Tu carrito está vacío</h3>
                    <p className="text-sm text-muted-foreground">
                      Explora el catálogo y agrega tus productos favoritos.
                    </p>
                    <Button className="mt-2 bg-[#b5121b] text-white hover:bg-[#920c15]" onClick={() => setIsCartOpen(false)}>
                      Seguir explorando
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                    {currentCart.map((item) => (
                      <article className="flex gap-3 rounded-xl border border-red-100 bg-white p-3" key={item.key}>
                        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-[#fff5f5]">
                          {item.imageUrl ? (
                            <Image
                              alt={item.productName}
                              className="object-contain p-1"
                              fill
                              sizes="80px"
                              src={item.imageUrl}
                              unoptimized
                            />
                          ) : (
                            <ShirtIcon className="m-auto mt-7 size-7 text-red-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="line-clamp-2 text-sm font-semibold">{item.productName}</h3>
                            <Button
                              aria-label={`Quitar ${item.productName} del carrito`}
                              className="size-7 shrink-0 text-muted-foreground hover:text-red-700"
                              onClick={() => changeCartQuantity(item.key, 0)}
                              size="icon-sm"
                              variant="ghost"
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.color} · Talla {item.size} · {item.catalogYear}
                          </p>
                          {item.available === 0 ? (
                            <p className="text-xs font-medium text-red-700">Ya no hay existencias disponibles. Retira esta prenda para continuar.</p>
                          ) : item.quantity > item.available ? (
                            <p className="text-xs font-medium text-red-700">Solo quedan {item.available}. Ajusta la cantidad.</p>
                          ) : null}
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-muted-foreground">
                              {item.available} disponibles
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                aria-label={`Reducir cantidad de ${item.productName}`}
                                className="size-7"
                                disabled={item.quantity <= 1}
                                onClick={() => changeCartQuantity(item.key, item.quantity - 1)}
                                size="icon-sm"
                                variant="outline"
                              >
                                <MinusIcon />
                              </Button>
                              <span aria-label="Cantidad" className="w-5 text-center text-sm font-semibold">
                                {item.quantity}
                              </span>
                              <Button
                                aria-label={`Aumentar cantidad de ${item.productName}`}
                                className="size-7"
                                disabled={item.quantity >= item.available}
                                onClick={() => changeCartQuantity(item.key, item.quantity + 1)}
                                size="icon-sm"
                                variant="outline"
                              >
                                <PlusIcon />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {currentCart.length > 0 && (
                  <SheetFooter className="border-t bg-white">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      El pedido se enviará a WhatsApp. El precio y la disponibilidad final serán confirmados por nuestro equipo.
                    </p>
                    {!canSendOrder && (
                      <p className="text-xs font-medium text-red-700" role="alert">
                        Actualiza las cantidades o retira los productos sin existencias para continuar.
                      </p>
                    )}
                    <Button
                      className="h-11 bg-[#16803c] font-semibold text-white hover:bg-[#126b32]"
                      disabled={!canSendOrder}
                      nativeButton={false}
                      render={
                        <a href={canSendOrder ? whatsappOrderUrl : undefined} rel="noreferrer" target="_blank" />
                      }
                    >
                      Enviar pedido por WhatsApp
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      WhatsApp · +57 312 415 7146
                    </p>
                  </SheetFooter>
                )}
              </SheetContent>
            </Sheet>
            <Button
              className="whitespace-nowrap bg-[#b5121b] px-2 text-xs text-white shadow-sm hover:bg-[#920c15] sm:px-3 sm:text-sm"
              nativeButton={false}
              render={<Link href="/login" />}
              size="sm"
            >
            Acceso al equipo
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:space-y-14 sm:px-6 sm:py-8">
        <div id="inicio">
          <PublicCatalogBanner banner={banner} />
        </div>
        <section aria-labelledby="categories-heading" className="space-y-4" id="colecciones">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-red-700 uppercase">Explora la tienda</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl" id="categories-heading">
                Compra por categoría
              </h2>
            </div>
            <button
              className="text-sm font-semibold text-red-700 transition-colors hover:text-red-900"
              onClick={() => {
                setSearch("")
                selectFolder({ kind: "all" })
              }}
              type="button"
            >
              Ver todo el catálogo <ArrowRightIcon className="ml-1 inline size-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {featuredCategories.map((category) => {
              const label = getSubcategoryLabel("Textiles", category)
              const categoryProducts = products.filter((product) => product.subcategory === category)
              const featuredProduct = categoryProducts.find((product) => product.image_url)
              return (
                <button
                  className="group relative isolate flex min-h-40 flex-col justify-end overflow-hidden rounded-xl border border-red-100 bg-gradient-to-br from-red-950 via-red-800 to-red-600 p-4 text-left text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg sm:min-h-52 sm:p-5"
                  key={category}
                  onClick={() => {
                    setSearch(category)
                    selectFolder({ kind: "all" })
                  }}
                  type="button"
                >
                  {featuredProduct?.image_url && (
                    <Image
                      alt=""
                      className="absolute inset-0 z-0 object-contain p-2 opacity-70 transition-transform duration-300 group-hover:scale-105 sm:p-4"
                      fill
                      sizes="(min-width: 640px) 25vw, 50vw"
                      src={featuredProduct.image_url}
                      unoptimized
                    />
                  )}
                  <span aria-hidden="true" className="absolute inset-0 z-10 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                  <span className="relative z-20 text-base font-semibold sm:text-lg">{label}</span>
                  <span className="relative z-20 mt-1 flex items-center justify-between gap-2 text-xs text-white/85">
                    {categoryProducts.length} {categoryProducts.length === 1 ? "producto" : "productos"}
                    <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              )
            })}
          </div>
        </section>
        <PublicCatalogCarousel slides={slides} />

        <section aria-labelledby="catalog-heading" className="scroll-mt-32 space-y-5" id="catalog">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold tracking-[0.2em] text-red-700 uppercase">
                Frenesi Sport · Colección actual
              </p>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" id="catalog-heading">
                Encuentra tu próxima prenda
              </h2>
              <p className="text-sm text-muted-foreground">
                Explora los productos, colores y tallas disponibles en nuestro inventario.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800">
                {products.length} productos
              </span>
              <span className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800">
                {totalAvailable} unidades disponibles
              </span>
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
                      {filteredProducts.map((product) => (
                        <PublicProductCard
                          cart={cart}
                          key={getProductKey(product)}
                          onAddToCart={addToCart}
                          product={product}
                        />
                      ))}
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
        <section
          aria-labelledby="about-heading"
          className="relative isolate overflow-hidden rounded-2xl bg-[#1a1112] px-6 py-10 text-white sm:px-10 sm:py-14"
          id="nosotros"
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 -z-10 w-2/3 bg-[radial-gradient(ellipse_at_right,rgba(181,18,27,0.55),transparent_65%)]"
          />
          <div className="max-w-2xl space-y-4">
            <p className="text-xs font-bold tracking-[0.2em] text-red-300 uppercase">Frenesi Sport</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-4xl" id="about-heading">
              Diseñamos prendas que representan a tu equipo.
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              Explora las referencias, consulta colores y tallas disponibles y arma tu pedido.
              Nuestro equipo te ayuda a confirmar el precio y continuar con la compra.
            </p>
            <Button
              className="bg-white font-semibold text-red-800 hover:bg-red-50"
              onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explorar productos <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </section>
        <div id="contacto">
          <PublicCatalogFooter footer={footer} />
        </div>
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
