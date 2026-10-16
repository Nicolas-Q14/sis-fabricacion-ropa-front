"use client"

import { useSyncExternalStore } from "react"
import {
  getDemoOrdersSnapshot,
  getServerDemoOrdersSnapshot,
  subscribeToDemoOrders,
} from "@/lib/orders/demo-storage"

export function useDemoOrders() {
  return useSyncExternalStore(
    subscribeToDemoOrders,
    getDemoOrdersSnapshot,
    getServerDemoOrdersSnapshot,
  )
}
