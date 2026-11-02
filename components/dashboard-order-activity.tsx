"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { DemoOrder } from "@/lib/orders/demo-data"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function orderDateKey(order: DemoOrder) {
  const date = order.entryDate ?? order.createdAt
  if (!date) return null
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(date)
  return dateOnly?.[1] ?? null
}

export function DashboardOrderActivity({
  orders,
  loading,
}: {
  orders: DemoOrder[]
  loading: boolean
}) {
  const today = new Date()
  const data = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index)
    const dateKey = localDateKey(date)
    const dailyOrders = orders.filter((order) => orderDateKey(order) === dateKey)

    return {
      date: new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric" })
        .format(date)
        .replace(".", ""),
      orders: dailyOrders.length,
      garments: dailyOrders.reduce((total, order) => total + order.quantity, 0),
    }
  })

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Actividad de pedidos</CardTitle>
        <CardDescription>Pedidos recibidos y prendas incluidas en los últimos 7 días.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
            Cargando actividad…
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-chart-1" />
                Pedidos
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-chart-2" />
                Prendas
              </span>
            </div>
            <div
              aria-label="Gráfica diaria de pedidos y prendas durante los últimos siete días"
              className="h-52 w-full"
              role="img"
            >
              <ResponsiveContainer height="100%" minWidth={0} width="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      value,
                      name === "orders" ? "Pedidos" : "Prendas",
                    ]}
                    labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                  />
                  <Bar dataKey="orders" fill="var(--chart-1)" name="orders" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="garments" fill="var(--chart-2)" name="garments" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
