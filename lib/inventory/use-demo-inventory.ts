"use client"

import { useEffect, useState } from "react"
import {
  readInventoryState,
  subscribeToInventory,
  type InventoryState,
} from "@/lib/inventory/demo-inventory"

export function useDemoInventory() {
  const [inventory, setInventory] = useState<InventoryState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function refresh() {
      try {
        setInventory(readInventoryState())
        setError(null)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "No se pudo cargar el inventario.")
      }
    }
    refresh()
    return subscribeToInventory(refresh)
  }, [])

  return { inventory, error }
}
