"use client"

import { useCallback, useEffect, useState } from "react"
import type { DemoOrder } from "@/lib/orders/demo-data"
import { loadSupabaseOrders } from "@/lib/orders/supabase-orders"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"
import { createClient } from "@/lib/supabase/client"

type OrdersSnapshot = {
  companyId: string | null
  orders: DemoOrder[]
  trashedOrders: DemoOrder[]
}

export function useDemoOrders() {
  const { companyId } = useOrdersOperator()
  const [snapshot, setSnapshot] = useState<OrdersSnapshot>({
    companyId: null,
    orders: [],
    trashedOrders: [],
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadSupabaseOrders(companyId)
      setSnapshot({ ...data, companyId })
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los pedidos.")
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    let cancelled = false
    void loadSupabaseOrders(companyId).then((data) => {
      if (cancelled) return
      setSnapshot({ ...data, companyId })
      setError(null)
      setLoading(false)
    }).catch((caught: unknown) => {
      if (cancelled) return
      setSnapshot({ companyId, orders: [], trashedOrders: [] })
      setError(caught instanceof Error ? caught.message : "No se pudieron cargar los pedidos.")
      setLoading(false)
    })
    const supabase = createClient()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(`orders-${companyId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `company_id=eq.${companyId}`,
      }, () => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => void refresh(), 100)
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "order_items",
        filter: `company_id=eq.${companyId}`,
      }, () => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => void refresh(), 100)
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "order_payments",
        filter: `company_id=eq.${companyId}`,
      }, () => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => void refresh(), 100)
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "order_events",
        filter: `company_id=eq.${companyId}`,
      }, () => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => void refresh(), 100)
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "production_events",
        filter: `company_id=eq.${companyId}`,
      }, () => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => void refresh(), 100)
      })
      .subscribe((status, subscriptionError) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError(subscriptionError?.message ?? "No se pudo activar la sincronización en tiempo real de pedidos.")
        }
      })

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
      void supabase.removeChannel(channel)
    }
  }, [companyId, refresh])

  const isCurrentCompany = snapshot.companyId === companyId
  return {
    orders: isCurrentCompany ? snapshot.orders : [],
    trashedOrders: isCurrentCompany ? snapshot.trashedOrders : [],
    error,
    loading: loading || !isCurrentCompany,
    refresh,
  }
}
