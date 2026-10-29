import { getOrderStatus, type DemoOrder } from "@/lib/orders/demo-data"

export type InventoryMovementType = "Entrada" | "Salida" | "Transferencia" | "Ajuste" | "Reserva"

export type InventoryVariant = {
  id: string
  color: string
  size: string
  barcode: string
  stockByWarehouse: Record<string, number>
  minStock: number
  maxStock: number
}

export type InventoryProduct = {
  id: string
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
  variants: InventoryVariant[]
}

export type InventoryMovement = {
  id: string
  date: string
  type: InventoryMovementType
  productName: string
  variantName: string
  quantity: number
  warehouse: string
  destination?: string
  reference: string
  note: string
  userId?: string | null
}

export type InventoryState = {
  products: InventoryProduct[]
  movements: InventoryMovement[]
  reservedByVariant?: Record<string, number>
  reservedByVariantWarehouse?: Record<string, Record<string, number>>
  warehouses?: { id: string; name: string }[]
}

export type OrderStockShortage = {
  orderId: string
  customer: string
  variantId: string
  product: string
  color: string
  size: string
  warehouse: string
  required: number
  physicalStock: number
  missing: number
}

export function getOrderStockShortages(
  orders: DemoOrder[],
  inventory: InventoryState,
): OrderStockShortage[] {
  const warehousesById = new Map(
    (inventory.warehouses ?? []).map((warehouse) => [warehouse.id, warehouse]),
  )
  const productsByVariant = new Map(
    inventory.products.flatMap((product) =>
      product.variants.map((variant) => [variant.id, { product, variant }] as const),
    ),
  )
  const sortedOrders = orders
    .filter((order) => getOrderStatus(order) !== "Entregado")
    .sort((left, right) =>
      (left.createdAt ?? left.entryDate ?? left.id)
        .localeCompare(right.createdAt ?? right.entryDate ?? right.id)
      || left.id.localeCompare(right.id),
    )
  const demandByVariantWarehouse = new Map<string, {
    variantId: string
    warehouseId: string
    orders: Map<string, { order: DemoOrder; quantity: number }>
  }>()

  for (const order of sortedOrders) {
    for (const item of order.items) {
      if (!item.inventoryVariantId || !item.inventoryWarehouseId) continue
      const key = JSON.stringify([item.inventoryVariantId, item.inventoryWarehouseId])
      const demand = demandByVariantWarehouse.get(key) ?? {
        variantId: item.inventoryVariantId,
        warehouseId: item.inventoryWarehouseId,
        orders: new Map(),
      }
      const orderDemand = demand.orders.get(order.id)
      demand.orders.set(order.id, {
        order,
        quantity: (orderDemand?.quantity ?? 0) + 1,
      })
      demandByVariantWarehouse.set(key, demand)
    }
  }

  const shortages: OrderStockShortage[] = []
  for (const demand of demandByVariantWarehouse.values()) {
    const { variantId, warehouseId } = demand
    const productVariant = productsByVariant.get(variantId)
    const warehouse = warehousesById.get(warehouseId)
    if (!productVariant || !warehouse) continue

    const physicalStock = productVariant.variant.stockByWarehouse[warehouse.name] ?? 0
    let committedQuantity = 0
    for (const { order, quantity } of demand.orders.values()) {
      const shortageBeforeOrder = Math.max(0, committedQuantity - physicalStock)
      committedQuantity += quantity
      const missing = Math.max(0, committedQuantity - physicalStock) - shortageBeforeOrder
      if (missing === 0) continue

      shortages.push({
        orderId: order.id,
        customer: order.customer,
        variantId,
        product: productVariant.product.name,
        color: productVariant.variant.color,
        size: productVariant.variant.size,
        warehouse: warehouse.name,
        required: quantity,
        physicalStock,
        missing,
      })
    }
  }

  return shortages
}

export function getLowStockVariants(inventory: InventoryState) {
  return inventory.products.flatMap((product) =>
    product.variants.flatMap((variant) => {
      const physical = Object.values(variant.stockByWarehouse)
        .reduce((sum, amount) => sum + amount, 0)
      const reserved = inventory.reservedByVariant?.[variant.id] ?? 0
      const available = Math.max(0, physical - reserved)
      return available <= variant.minStock
        ? [{ product: product.name, color: variant.color, size: variant.size, available }]
        : []
    }),
  )
}
