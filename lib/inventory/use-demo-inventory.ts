"use client"

import { useCallback, useEffect, useState } from "react"
import type {
  InventoryMovement,
  InventoryState,
} from "@/lib/inventory/demo-inventory"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"
import { createClient } from "@/lib/supabase/client"

type ProductRow = {
  id: string
  sku: string
  name: string
  description: string | null
  category: string | null
  subcategory: string | null
  catalog_year: number
  gender: string | null
  unit_price: number
  barcode: string | null
  image_url: string | null
}

type VariantRow = {
  id: string
  product_id: string
  color: string
  size: string
  barcode: string | null
  min_stock: number
  max_stock: number | null
}

type StockRow = {
  variant_id: string
  warehouse_id: string
  quantity: number
}

type WarehouseRow = { id: string; name: string }

type MovementRow = {
  id: string
  variant_id: string
  warehouse_id: string
  movement_type: string
  quantity: number
  reference: string | null
  notes: string | null
  created_by_user_id: string | null
  created_at: string
}

type ReservationItemRow = {
  id: string
  order_id: string
  inventory_variant_id: string | null
  inventory_warehouse_id: string | null
  created_at: string
}

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function loadSupabaseInventory(companyId: string): Promise<InventoryState> {
  const supabase = createClient()
  const [
    { data: productData, error: productError },
    { data: variantData, error: variantError },
    { data: stockData, error: stockError },
    { data: warehouseData, error: warehouseError },
    { data: movementData, error: movementError },
    { data: activeOrderData, error: activeOrderError },
  ] = await Promise.all([
    supabase.from("inventory_products")
      .select("id, sku, name, description, category, subcategory, catalog_year, gender, unit_price, barcode, image_url")
      .eq("company_id", companyId)
      .order("name"),
    supabase.from("inventory_variants")
      .select("id, product_id, color, size, barcode, min_stock, max_stock")
      .eq("company_id", companyId),
    supabase.from("inventory_stock")
      .select("variant_id, warehouse_id, quantity")
      .eq("company_id", companyId),
    supabase.from("inventory_warehouses").select("id, name").eq("company_id", companyId).eq("is_active", true),
    supabase.from("inventory_movements")
      .select("id, variant_id, warehouse_id, movement_type, quantity, reference, notes, created_by_user_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("orders").select("id, created_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("stock_deducted_at", null),
  ])
  throwOnError(productError)
  throwOnError(variantError)
  throwOnError(stockError)
  throwOnError(warehouseError)
  throwOnError(movementError)
  throwOnError(activeOrderError)

  const products = (productData ?? []) as ProductRow[]
  const variants = (variantData ?? []) as VariantRow[]
  const stocks = (stockData ?? []) as StockRow[]
  const warehouses = (warehouseData ?? []) as WarehouseRow[]
  const movements = (movementData ?? []) as MovementRow[]
  const activeOrderIds = (activeOrderData ?? []).map((order) => order.id)
  let reservationItems: ReservationItemRow[] = []
  if (activeOrderIds.length > 0) {
    const { data, error: reservationError } = await supabase
      .from("order_items")
      .select("id, order_id, inventory_variant_id, inventory_warehouse_id, created_at")
      .eq("company_id", companyId)
      .in("order_id", activeOrderIds)
      .not("inventory_variant_id", "is", null)
    throwOnError(reservationError)
    reservationItems = (data ?? []) as ReservationItemRow[]
  }
  const reservedByVariant: Record<string, number> = {}
  const reservedByVariantWarehouse: Record<string, Record<string, number>> = {}
  for (const item of reservationItems) {
    if (!item.inventory_variant_id) continue
    reservedByVariant[item.inventory_variant_id] =
      (reservedByVariant[item.inventory_variant_id] ?? 0) + 1
    if (item.inventory_warehouse_id) {
      const reservationsForVariant = reservedByVariantWarehouse[item.inventory_variant_id] ?? {}
      reservationsForVariant[item.inventory_warehouse_id] =
        (reservationsForVariant[item.inventory_warehouse_id] ?? 0) + 1
      reservedByVariantWarehouse[item.inventory_variant_id] = reservationsForVariant
    }
  }
  const productsById = new Map(products.map((product) => [product.id, product]))
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]))
  const warehousesById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]))
  const stockByVariant = new Map<string, Record<string, number>>()
  for (const stock of stocks) {
    const warehouseName = warehousesById.get(stock.warehouse_id)?.name
    if (!warehouseName) continue
    const values = stockByVariant.get(stock.variant_id) ?? {}
    values[warehouseName] = Number(stock.quantity)
    stockByVariant.set(stock.variant_id, values)
  }
  const inventoryMovements = movements.flatMap((movement): InventoryMovement[] => {
    const variant = variantsById.get(movement.variant_id)
    const product = variant ? productsById.get(variant.product_id) : null
    const warehouse = warehousesById.get(movement.warehouse_id)
    if (!variant || !product || !warehouse) return []
    const isTransfer = movement.movement_type === "transferencia"
    if (isTransfer && movement.notes?.includes("Transferencia desde ")) return []
    return [{
      id: movement.id,
      date: movement.created_at,
      type: isTransfer
        ? "Transferencia"
        : movement.movement_type === "entrada"
          ? "Entrada"
          : movement.movement_type === "ajuste"
            ? "Ajuste"
            : "Salida",
      productName: product.name,
      variantName: `${variant.color} · ${variant.size}`,
      quantity: Number(movement.quantity),
      warehouse: warehouse.name,
      destination: isTransfer ? movement.notes?.split("Transferencia hacia ")[1] : undefined,
      reference: movement.reference ?? "",
      note: movement.notes ?? "",
      userId: movement.created_by_user_id,
    }]
  })
  const ordersById = new Map((activeOrderData ?? []).map((order) => [order.id, order]))
  const reservationMovements = reservationItems.flatMap((item): InventoryMovement[] => {
    const variant = item.inventory_variant_id
      ? variantsById.get(item.inventory_variant_id)
      : null
    const product = variant ? productsById.get(variant.product_id) : null
    const warehouse = item.inventory_warehouse_id
      ? warehousesById.get(item.inventory_warehouse_id)
      : null
    if (!variant || !product || !warehouse) return []
    return [{
      id: `reservation-${item.id}`,
      date: item.created_at,
      type: "Reserva",
      productName: product.name,
      variantName: `${variant.color} · ${variant.size}`,
      quantity: -1,
      warehouse: warehouse.name,
      reference: ordersById.get(item.order_id)?.id ?? item.order_id,
      note: "Reserva activa de un pedido; aún no descuenta stock físico.",
      userId: null,
    }]
  })
  const recentMovements = [...inventoryMovements, ...reservationMovements]
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date))
    .slice(0, 200)

  return {
    products: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description ?? "",
      category: product.category ?? "Sin categoría",
      subcategory: product.subcategory ?? "otros",
      catalogYear: Number(product.catalog_year),
      gender: product.gender ?? "Unisex",
      price: Number(product.unit_price),
      barcode: product.barcode ?? "",
      imageUrl: product.image_url ?? "",
      variants: variants.filter((variant) => variant.product_id === product.id).map((variant) => ({
        id: variant.id,
        color: variant.color,
        size: variant.size,
        barcode: variant.barcode ?? "",
        stockByWarehouse: stockByVariant.get(variant.id) ?? {},
        minStock: Number(variant.min_stock),
        maxStock: Number(variant.max_stock ?? 100),
      })),
    })),
    movements: recentMovements,
    deductedOrderIds: [],
    reservedByVariant,
    reservedByVariantWarehouse,
    warehouses,
  }
}

export async function saveSupabaseProduct(
  companyId: string,
  product: {
    id: string | null
    sku: string
    name: string
    description: string
    category: string
    subcategory: string
    catalogYear: number
    gender: string
    price: number
    barcode: string
    imageUrl: string
    variants: { color: string; size: string; barcode: string }[]
    initialStock: number
    minStock: number
    maxStock: number
  },
) {
  const supabase = createClient()
  const { error } = await supabase.rpc("save_inventory_catalog_product", {
    p_company_id: companyId,
    p_product_id: product.id,
    p_sku: product.sku,
    p_name: product.name,
    p_description: product.description,
    p_category: product.category,
    p_subcategory: product.subcategory,
    p_catalog_year: product.catalogYear,
    p_gender: product.gender,
    p_unit_price: product.price,
    p_barcode: product.barcode || null,
    p_image_url: product.imageUrl || null,
    p_variants: product.variants,
    p_initial_stock: product.initialStock,
    p_min_stock: product.minStock,
    p_max_stock: product.maxStock,
  })
  throwOnError(error)
}

export async function deleteSupabaseProduct(companyId: string, productId: string) {
  const supabase = createClient()
  const { error } = await supabase.rpc("delete_inventory_product", {
    p_company_id: companyId,
    p_product_id: productId,
  })
  throwOnError(error)
}

export async function saveSupabaseInventoryMovement(
  companyId: string,
  movement: {
    type: string
    variantId: string
    quantity: number
    warehouse: string
    destination?: string
    reference: string
    note: string
  },
) {
  const supabase = createClient()
  const type = {
    Entrada: "entrada",
    Salida: "salida",
    Transferencia: "transferencia",
    Ajuste: "ajuste",
  }[movement.type]
  if (!type) throw new Error("El tipo de movimiento no es válido.")
  const { error } = await supabase.rpc("apply_inventory_movement", {
    p_company_id: companyId,
    p_variant_id: movement.variantId,
    p_type: type,
    p_quantity: movement.quantity,
    p_warehouse_name: movement.warehouse,
    p_destination_name: movement.destination || null,
    p_reference: movement.reference || null,
    p_notes: movement.note || null,
  })
  throwOnError(error)
}

export async function saveSupabaseInventoryStockBatch(
  companyId: string,
  input: {
    productId: string
    type: "Entrada" | "Salida"
    warehouse: string
    note: string
    items: (
      | { variantId: string; quantity: number }
      | { color: string; size: string; quantity: number }
    )[]
  },
) {
  if (!input.items.length) throw new Error("Ingresa unidades para al menos una variante.")
  const supabase = createClient()
  const { error } = await supabase.rpc("apply_inventory_reference_stock_batch", {
    p_company_id: companyId,
    p_product_id: input.productId,
    p_type: input.type === "Entrada" ? "entrada" : "salida",
    p_warehouse_name: input.warehouse,
    p_items: input.items.map((item) => ({
      quantity: item.quantity,
      ...("variantId" in item
        ? { variant_id: item.variantId }
        : { color: item.color, size: item.size }),
    })),
    p_notes: input.note.trim() || null,
  })
  throwOnError(error)
}

export function useDemoInventory() {
  const { companyId } = useOrdersOperator()
  const [inventory, setInventory] = useState<InventoryState | null>(null)
  const [loadedCompanyId, setLoadedCompanyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setInventory(await loadSupabaseInventory(companyId))
      setLoadedCompanyId(companyId)
      setError(null)
    } catch (caught) {
      setLoadedCompanyId(companyId)
      setInventory(null)
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el inventario.")
    }
  }, [companyId])

  useEffect(() => {
    let cancelled = false
    void loadSupabaseInventory(companyId).then((data) => {
      if (cancelled) return
      setInventory(data)
      setLoadedCompanyId(companyId)
      setError(null)
    }).catch((caught: unknown) => {
      if (cancelled) return
      setLoadedCompanyId(companyId)
      setInventory(null)
      setError(caught instanceof Error ? caught.message : "No se pudo cargar el inventario.")
    })
    const supabase = createClient()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const tables = [
      "inventory_products",
      "inventory_variants",
      "inventory_stock",
      "inventory_movements",
      "inventory_warehouses",
      "orders",
      "order_items",
    ]
    const channel = supabase.channel(`inventory-${companyId}`)
    for (const table of tables) {
      channel.on("postgres_changes", {
        event: "*",
        schema: "public",
        table,
        filter: `company_id=eq.${companyId}`,
      }, () => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => void refresh(), 100)
      })
    }
    channel.subscribe((status, subscriptionError) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setError(subscriptionError?.message ?? "No se pudo activar la sincronización en tiempo real del inventario.")
      }
    })
    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
      void supabase.removeChannel(channel)
    }
  }, [companyId, refresh])

  const isCurrentCompany = loadedCompanyId === companyId
  return {
    inventory: isCurrentCompany ? inventory : null,
    error: isCurrentCompany ? error : null,
    refresh,
  }
}
