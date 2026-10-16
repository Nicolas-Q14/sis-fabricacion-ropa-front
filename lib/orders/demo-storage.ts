import { demoOrders, getOrderStatus, type DemoOrder } from "@/lib/orders/demo-data"

const storageKey = "frenesi-demo-orders"
let cachedStorageValue: string | null | undefined
let cachedSnapshot: { orders: DemoOrder[]; error: string | null } = {
  orders: demoOrders,
  error: null,
}
const serverSnapshot = { orders: demoOrders, error: null }

export function readStoredOrders(): DemoOrder[] {
  const raw = window.localStorage.getItem(storageKey)
  if (!raw) return []

  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every(isDemoOrder)) {
    throw new Error("Los pedidos de demostración guardados tienen un formato inválido.")
  }

  return parsed.map((order) => ({
    ...order,
    status: getOrderStatus(order),
    items: order.items.map((item) => ({
      ...item,
      production: item.production ?? { currentPhase: 0, verifications: [] },
    })),
  }))
}

export function saveStoredOrders(orders: DemoOrder[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(orders))
  window.dispatchEvent(new Event("frenesi-demo-orders-change"))
}

export function upsertStoredOrder(order: DemoOrder) {
  const orders = readStoredOrders()
  saveStoredOrders([order, ...orders.filter((item) => item.id !== order.id)])
}

export function getDemoOrdersSnapshot() {
  try {
    const currentStorageValue = window.localStorage.getItem(storageKey)
    if (currentStorageValue === cachedStorageValue) return cachedSnapshot
    cachedStorageValue = currentStorageValue
    const storedOrders = readStoredOrders()
    const storedById = new Map(storedOrders.map((order) => [order.id, order]))
    const storedIds = new Set(storedById.keys())
    cachedSnapshot = {
      orders: [
        ...storedOrders,
        ...demoOrders.filter((order) => !storedIds.has(order.id)).map(
          (order) => storedById.get(order.id) ?? order,
        ),
      ],
      error: null,
    }
  } catch (error) {
    cachedSnapshot = {
      orders: demoOrders,
      error: error instanceof Error ? error.message : "No se pudieron cargar los pedidos guardados.",
    }
  }

  return cachedSnapshot
}

export function getServerDemoOrdersSnapshot() {
  return serverSnapshot
}

export function subscribeToDemoOrders(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener("frenesi-demo-orders-change", onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener("frenesi-demo-orders-change", onChange)
  }
}

function isDemoOrder(value: unknown): value is DemoOrder {
  if (typeof value !== "object" || value === null) return false
  const order = value as Record<string, unknown>
  return typeof order.id === "string"
    && typeof order.customer === "string"
    && typeof order.quantity === "number"
    && typeof order.total === "number"
    && Array.isArray(order.items)
    && Array.isArray(order.timeline)
}
