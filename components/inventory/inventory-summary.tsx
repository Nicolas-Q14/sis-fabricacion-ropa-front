"use client"

import Link from "next/link"
import { AlertTriangleIcon, ArrowRightIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getLowStockVariants, type InventoryState } from "@/lib/inventory/demo-inventory"

export function InventorySummary({
  inventory,
  inventoryError,
}: {
  inventory: InventoryState | null
  inventoryError: string | null
}) {
  const lowStock = inventory ? getLowStockVariants(inventory) : []

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5" />
            Alertas de stock bajo
            {lowStock.length > 0 && <Badge variant="destructive">{lowStock.length}</Badge>}
          </CardTitle>
          <CardDescription>Variantes con disponible igual o inferior al mínimo definido.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {inventoryError ? (
            <p className="text-sm text-destructive">{inventoryError}</p>
          ) : !inventory ? (
            <p className="text-sm text-muted-foreground">Cargando existencias…</p>
          ) : lowStock.length ? (
            <ul className="space-y-2">
              {lowStock.slice(0, 6).map((item) => (
                <li className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm" key={`${item.product}-${item.color}-${item.size}`}>
                  <span className="min-w-0 truncate">{item.product} · {item.color} · {item.size}</span>
                  <Badge variant="destructive">{item.available} disponibles</Badge>
                </li>
              ))}
              {lowStock.length > 6 && (
                <li className="text-xs text-muted-foreground">
                  Y {lowStock.length - 6} variantes más requieren revisión.
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No hay alertas de stock bajo.</p>
          )}
          <Button nativeButton={false} render={<Link href="/dashboard/inventory" />} size="sm" variant="outline">
            Revisar inventario <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos recientes</CardTitle>
          <CardDescription>Últimos cambios de existencias registrados en el inventario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {inventoryError ? (
            <p className="text-sm text-destructive">{inventoryError}</p>
          ) : !inventory ? (
            <p className="text-sm text-muted-foreground">Cargando movimientos…</p>
          ) : inventory.movements.length ? (
            <ul className="space-y-2">
              {inventory.movements.slice(0, 5).map((movement) => (
                <li className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm" key={movement.id}>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{movement.productName} · {movement.variantName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(movement.date))}
                      {" · "}{movement.type}
                    </p>
                  </div>
                  <Badge variant={movement.quantity < 0 ? "outline" : "secondary"}>
                    {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Todavía no hay movimientos registrados.</p>
          )}
          <Button nativeButton={false} render={<Link href="/dashboard/inventory" />} size="sm" variant="outline">
            Ver inventario <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
