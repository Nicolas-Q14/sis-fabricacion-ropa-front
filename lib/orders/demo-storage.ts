import { demoOrders, getOrderStatus, type DemoOrder } from "@/lib/orders/demo-data"
import {
  readInventoryState,
  reconcileInventoryOrders,
  saveInventoryState,
} from "@/lib/inventory/demo-inventory"

const storageKey = "frenesi-demo-orders"
const trashStorageKey = "frenesi-demo-orders-trash"
const deletedStorageKey = "frenesi-demo-orders-deleted"
let cachedStorageValue: string | null | undefined
let cachedSnapshot: { orders: DemoOrder[]; trashedOrders: DemoOrder[]; error: string | null } = {
  orders: demoOrders,
  trashedOrders: [],
  error: null,
}
const serverSnapshot = { orders: demoOrders, trashedOrders: [], error: null }

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
      color: item.color || "Azul marino",
      production: item.production ?? { currentPhase: 0, verifications: [] },
    })),
  }))
}

export function saveStoredOrders(orders: DemoOrder[]) {
  const previousValue = window.localStorage.getItem(storageKey)
  window.localStorage.setItem(storageKey, JSON.stringify(orders))
  try {
    const deletedOrderIds = new Set(readDeletedOrderIds())
    const ordersById = new Map(
      demoOrders
        .filter((order) => !deletedOrderIds.has(order.id))
        .map((order) => [order.id, order]),
    )
    for (const order of orders) ordersById.set(order.id, order)
    const inventory = reconcileInventoryOrders(readInventoryState(), [...ordersById.values()])
    saveInventoryState(inventory)
  } catch (error) {
    if (previousValue === null) window.localStorage.removeItem(storageKey)
    else window.localStorage.setItem(storageKey, previousValue)
    throw error
  }
  window.dispatchEvent(new Event("frenesi-demo-orders-change"))
}

export function upsertStoredOrder(order: DemoOrder) {
  const orders = readStoredOrders()
  saveStoredOrders([order, ...orders.filter((item) => item.id !== order.id)])
}

export function moveOrderToTrash(orderId: string) {
  updateTrashedOrderIds((orderIds) => [...new Set([...orderIds, orderId])])
}

export function restoreOrderFromTrash(orderId: string) {
  updateTrashedOrderIds((orderIds) => orderIds.filter((id) => id !== orderId))
}

export function deleteOrderPermanently(orderId: string) {
  const deletedOrderIds = new Set(readDeletedOrderIds())
  deletedOrderIds.add(orderId)
  window.localStorage.setItem(deletedStorageKey, JSON.stringify([...deletedOrderIds]))

  try {
    saveStoredOrders(readStoredOrders().filter((order) => order.id !== orderId))
    updateTrashedOrderIds((orderIds) => orderIds.filter((id) => id !== orderId))
  } catch (error) {
    deletedOrderIds.delete(orderId)
    if (deletedOrderIds.size === 0) window.localStorage.removeItem(deletedStorageKey)
    else window.localStorage.setItem(deletedStorageKey, JSON.stringify([...deletedOrderIds]))
    throw error
  }
}

export function getDemoOrdersSnapshot() {
  try {
    const currentStorageValue = window.localStorage.getItem(storageKey)
    const currentTrashValue = window.localStorage.getItem(trashStorageKey)
    const currentDeletedValue = window.localStorage.getItem(deletedStorageKey)
    const currentSnapshotValue = JSON.stringify([
      currentStorageValue,
      currentTrashValue,
      currentDeletedValue,
    ])
    if (currentSnapshotValue === cachedStorageValue) return cachedSnapshot
    cachedStorageValue = currentSnapshotValue
    const storedOrders = readStoredOrders()
    const storedById = new Map(storedOrders.map((order) => [order.id, order]))
    const storedIds = new Set(storedById.keys())
    const allOrders = [
      ...storedOrders,
      ...demoOrders.filter((order) => !storedIds.has(order.id)),
    ].filter((order) => !readDeletedOrderIds().includes(order.id))
    const trashedOrderIds = new Set(readTrashedOrderIds())
    cachedSnapshot = {
      orders: allOrders.filter((order) => !trashedOrderIds.has(order.id)),
      trashedOrders: allOrders.filter((order) => trashedOrderIds.has(order.id)),
      error: null,
    }
  } catch (error) {
    cachedSnapshot = {
      orders: demoOrders,
      trashedOrders: [],
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

function updateTrashedOrderIds(update: (orderIds: string[]) => string[]) {
  const nextOrderIds = update([...new Set(readTrashedOrderIds())])
  window.localStorage.setItem(trashStorageKey, JSON.stringify(nextOrderIds))
  window.dispatchEvent(new Event("frenesi-demo-orders-change"))
}

function readTrashedOrderIds() {
  const raw = window.localStorage.getItem(trashStorageKey)
  if (!raw) return []

  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
    throw new Error("La papelera de pedidos guardada tiene un formato inválido.")
  }

  return parsed
}

function readDeletedOrderIds() {
  const raw = window.localStorage.getItem(deletedStorageKey)
  if (!raw) return []

  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
    throw new Error("Los pedidos eliminados guardados tienen un formato inválido.")
  }

  return parsed
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
