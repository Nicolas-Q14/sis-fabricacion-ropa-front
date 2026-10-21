import { getOrderStatus, type DemoOrder } from "@/lib/orders/demo-data"

export const MAIN_WAREHOUSE = "Bodega principal"

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
  deductedOrderIds: string[]
  reservedByVariant?: Record<string, number>
  reservedByVariantWarehouse?: Record<string, Record<string, number>>
  warehouses?: { id: string; name: string }[]
}

export type InventoryMovementInput = {
  type: InventoryMovementType
  variantId: string
  quantity: number
  warehouse: string
  destination?: string
  reference: string
  note: string
}

const storageKey = "frenesi-demo-inventory"
const sizes = ["4", "6", "8", "10", "12", "14", "XS", "S", "M", "L", "XL", "XXL"]
const colors = ["Azul marino", "Blanco", "Negro"]
const initialCatalog = [
  { sku: "FS-2026-TEX-CAM-001", name: "Camiseta", description: "Camiseta deportiva personalizable", category: "Textiles", subcategory: "camisetas", catalogYear: 2026, gender: "Unisex", price: 60000 },
  { sku: "FS-2026-TEX-PAN-001", name: "Pantaloneta", description: "Pantaloneta deportiva", category: "Textiles", subcategory: "pantalonetas", catalogYear: 2026, gender: "Unisex", price: 40000 },
  { sku: "FS-2026-TEX-SUD-001", name: "Sudadera", description: "Sudadera institucional", category: "Textiles", subcategory: "sudaderas", catalogYear: 2026, gender: "Unisex", price: 75000 },
  { sku: "FS-2026-TEX-CHA-001", name: "Chaqueta", description: "Chaqueta deportiva", category: "Textiles", subcategory: "chaquetas", catalogYear: 2026, gender: "Unisex", price: 95000 },
  { sku: "FS-2026-TEX-MED-001", name: "Medias", description: "Medias deportivas", category: "Textiles", subcategory: "medias", catalogYear: 2026, gender: "Unisex", price: 18000 },
]

function makeInitialState(): InventoryState {
  return {
    products: initialCatalog.map((product, productIndex) => ({
      ...product,
      id: `product-${product.sku.toLowerCase()}`,
      barcode: `77010000000${productIndex + 1}`,
      imageUrl: "",
      variants: colors.flatMap((color, colorIndex) =>
        sizes.map((size, sizeIndex) => ({
          id: `${product.sku}-${colorIndex + 1}-${sizeIndex + 1}`,
          color,
          size,
          barcode: `770${String(productIndex + 1).padStart(2, "0")}${String(colorIndex + 1).padStart(2, "0")}${String(sizeIndex + 1).padStart(6, "0")}`,
          stockByWarehouse: { [MAIN_WAREHOUSE]: 30 },
          minStock: 5,
          maxStock: 100,
        })),
      ),
    })),
    movements: [],
    deductedOrderIds: [],
  }
}

export function readInventoryState(): InventoryState {
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return makeInitialState()
  const value: unknown = JSON.parse(raw)
  if (!isInventoryState(value)) {
    throw new Error("Los datos de inventario guardados tienen un formato inválido.")
  }
  return {
    ...value,
    products: value.products.map((product) => ({
      ...product,
      category: product.category === "Promocionales" ? "Promocionales" : "Textiles",
      subcategory: product.subcategory ?? inferSubcategory(product.name),
      catalogYear: product.catalogYear ?? 2026,
    })),
  }
}

export function saveInventoryState(state: InventoryState) {
  window.localStorage.setItem(storageKey, JSON.stringify(state))
  window.dispatchEvent(new Event("frenesi-demo-inventory-change"))
}

export function subscribeToInventory(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener("frenesi-demo-inventory-change", onChange)
  window.addEventListener("frenesi-demo-orders-change", onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("frenesi-demo-inventory-change", onChange)
    window.removeEventListener("frenesi-demo-orders-change", onChange)
  }
}

export function getVariantReservations(
  products: InventoryProduct[],
  orders: DemoOrder[],
) {
  const productByName = new Map(products.map((product) => [product.name.toLocaleLowerCase(), product]))
  const reservations = new Map<string, number>()

  for (const order of orders) {
    if (getOrderStatus(order) === "Entregado") continue
    for (const item of order.items) {
      const product = productByName.get(item.garment.toLocaleLowerCase())
      const variant = product?.variants.find(
        (candidate) => candidate.color === (item.color || "Azul marino") && candidate.size === item.size,
      )
      if (variant) reservations.set(variant.id, (reservations.get(variant.id) ?? 0) + 1)
    }
  }
  return reservations
}

export function reconcileInventoryOrders(state: InventoryState, orders: DemoOrder[]) {
  const nextState: InventoryState = {
    ...state,
    products: state.products.map((product) => ({
      ...product,
      variants: product.variants.map((variant) => ({
        ...variant,
        stockByWarehouse: { ...variant.stockByWarehouse },
      })),
    })),
    movements: [...state.movements],
    deductedOrderIds: [...state.deductedOrderIds],
  }
  const productByName = new Map(nextState.products.map((product) => [product.name.toLocaleLowerCase(), product]))
  const newlyDelivered = orders.filter(
    (order) => getOrderStatus(order) === "Entregado" && !nextState.deductedOrderIds.includes(order.id),
  )
  const activeReservations = getVariantReservations(nextState.products, orders)

  for (const order of newlyDelivered) {
    const demand = new Map<string, number>()
    for (const item of order.items) {
      const product = productByName.get(item.garment.toLocaleLowerCase())
      const variant = product?.variants.find(
        (candidate) => candidate.color === (item.color || "Azul marino") && candidate.size === item.size,
      )
      if (variant) demand.set(variant.id, (demand.get(variant.id) ?? 0) + 1)
    }

    for (const [variantId, quantity] of demand) {
      const variant = nextState.products.flatMap((product) => product.variants).find((item) => item.id === variantId)
      if (!variant) continue
      const reservedByOthers = (activeReservations.get(variantId) ?? 0)
      const mainWarehouseStock = variant.stockByWarehouse[MAIN_WAREHOUSE] ?? 0
      if (mainWarehouseStock < quantity + reservedByOthers) {
        throw new Error(`No hay existencias suficientes para completar el pedido ${order.id}.`)
      }
      variant.stockByWarehouse[MAIN_WAREHOUSE] = mainWarehouseStock - quantity
      const product = nextState.products.find((candidate) =>
        candidate.variants.some((item) => item.id === variantId),
      )
      nextState.movements.unshift({
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: "Salida",
        productName: product?.name ?? "Producto",
        variantName: `${variant.color} · ${variant.size}`,
        quantity: -quantity,
        warehouse: MAIN_WAREHOUSE,
        reference: order.id,
        note: "Descuento automático al entregar el pedido.",
      })
    }
    nextState.deductedOrderIds.push(order.id)
  }

  const reservations = getVariantReservations(nextState.products, orders)
  for (const product of nextState.products) {
    for (const variant of product.variants) {
      const physical = Object.values(variant.stockByWarehouse).reduce((total, amount) => total + amount, 0)
      if ((reservations.get(variant.id) ?? 0) > physical) {
        throw new Error(`Existencias insuficientes para reservar ${product.name}, ${variant.color}, talla ${variant.size}.`)
      }
    }
  }
  return nextState
}

export function applyInventoryMovement(
  state: InventoryState,
  input: InventoryMovementInput,
  reservations: Map<string, number>,
): InventoryState {
  const quantity = input.quantity
  if (!Number.isInteger(quantity) || quantity === 0) {
    throw new Error("Ingresa una cantidad entera distinta de cero.")
  }
  if (input.type !== "Ajuste" && quantity < 0) {
    throw new Error("La cantidad de este movimiento debe ser positiva.")
  }
  if (!input.warehouse.trim()) throw new Error("Indica el almacén del movimiento.")

  const products = state.products.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => ({
      ...variant,
      stockByWarehouse: { ...variant.stockByWarehouse },
    })),
  }))
  const product = products.find((candidate) => candidate.variants.some((variant) => variant.id === input.variantId))
  const variant = product?.variants.find((candidate) => candidate.id === input.variantId)
  if (!product || !variant) throw new Error("Selecciona una variante válida.")

  const sourceStock = variant.stockByWarehouse[input.warehouse] ?? 0
  const reserved = reservations.get(variant.id) ?? 0
  let movementQuantity = quantity
  if (input.type === "Entrada") {
    variant.stockByWarehouse[input.warehouse] = sourceStock + quantity
  } else if (input.type === "Transferencia") {
    const destination = input.destination?.trim()
    if (!destination || destination === input.warehouse) {
      throw new Error("Selecciona un almacén de destino distinto al de origen.")
    }
    const reservedAtSource = input.warehouse === MAIN_WAREHOUSE ? reserved : 0
    if (sourceStock - reservedAtSource < quantity) {
      throw new Error("La transferencia supera las existencias disponibles no reservadas.")
    }
    variant.stockByWarehouse[input.warehouse] = sourceStock - quantity
    variant.stockByWarehouse[destination] = (variant.stockByWarehouse[destination] ?? 0) + quantity
  } else {
    const signedQuantity = input.type === "Ajuste" ? quantity : -Math.abs(quantity)
    const reservedAtSource = input.warehouse === MAIN_WAREHOUSE ? reserved : 0
    if (sourceStock + signedQuantity < reservedAtSource) {
      throw new Error("El movimiento dejaría menos existencias que las ya reservadas por pedidos.")
    }
    if (sourceStock + signedQuantity < 0) {
      throw new Error("No hay existencias suficientes en el almacén seleccionado.")
    }
    variant.stockByWarehouse[input.warehouse] = sourceStock + signedQuantity
    movementQuantity = signedQuantity
  }

  return {
    ...state,
    products,
    movements: [{
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      type: input.type,
      productName: product.name,
      variantName: `${variant.color} · ${variant.size}`,
      quantity: movementQuantity,
      warehouse: input.warehouse,
      destination: input.destination?.trim() || undefined,
      reference: input.reference.trim(),
      note: input.note.trim(),
    }, ...state.movements],
  }
}

function isInventoryState(value: unknown): value is InventoryState {
  if (!isRecord(value)) return false
  return Array.isArray(value.products)
    && value.products.every(isInventoryProduct)
    && Array.isArray(value.movements)
    && value.movements.every(isInventoryMovement)
    && Array.isArray(value.deductedOrderIds)
    && value.deductedOrderIds.every((id) => typeof id === "string")
}

function isInventoryProduct(value: unknown): value is InventoryProduct {
  if (!isRecord(value)) return false
  return typeof value.id === "string"
    && typeof value.sku === "string"
    && typeof value.name === "string"
    && typeof value.description === "string"
    && typeof value.category === "string"
    && (value.subcategory === undefined || typeof value.subcategory === "string")
    && (value.catalogYear === undefined || Number.isInteger(value.catalogYear))
    && typeof value.gender === "string"
    && typeof value.price === "number"
    && typeof value.barcode === "string"
    && typeof value.imageUrl === "string"
    && Array.isArray(value.variants)
    && value.variants.every(isInventoryVariant)
}

function inferSubcategory(name: string) {
  const normalizedName = name.toLocaleLowerCase()
  if (normalizedName.includes("camiseta")) return "camisetas"
  if (normalizedName.includes("pantaloneta")) return "pantalonetas"
  if (normalizedName.includes("sudadera")) return "sudaderas"
  if (normalizedName.includes("chaqueta")) return "chaquetas"
  if (normalizedName.includes("media")) return "medias"
  if (normalizedName.includes("termo") || normalizedName.includes("mug")) return "mugs_y_termos"
  if (normalizedName.includes("toalla")) return "toallas_microfibra"
  return "otros"
}

function isInventoryVariant(value: unknown): value is InventoryVariant {
  if (!isRecord(value) || !isRecord(value.stockByWarehouse)) return false
  return typeof value.id === "string"
    && typeof value.color === "string"
    && typeof value.size === "string"
    && typeof value.barcode === "string"
    && Object.values(value.stockByWarehouse).every(
      (quantity) => Number.isInteger(quantity) && Number(quantity) >= 0,
    )
    && Number.isInteger(value.minStock)
    && Number(value.minStock) >= 0
    && Number.isInteger(value.maxStock)
    && Number(value.maxStock) >= Number(value.minStock)
}

function isInventoryMovement(value: unknown): value is InventoryMovement {
  if (!isRecord(value)) return false
  return typeof value.id === "string"
    && typeof value.date === "string"
    && Number.isFinite(Date.parse(value.date))
    && movementTypes.includes(value.type as InventoryMovementType)
    && typeof value.productName === "string"
    && typeof value.variantName === "string"
    && Number.isInteger(value.quantity)
    && typeof value.warehouse === "string"
    && (value.destination === undefined || typeof value.destination === "string")
    && typeof value.reference === "string"
    && typeof value.note === "string"
}

const movementTypes: InventoryMovementType[] = ["Entrada", "Salida", "Transferencia", "Ajuste"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
