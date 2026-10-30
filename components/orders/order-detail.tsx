"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CreditCardIcon,
  MessageCircleIcon,
  PrinterIcon,
  ShirtIcon,
} from "lucide-react"
import { OrderStatusBadge } from "@/components/orders/orders-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  formatCurrency,
  formatShortDate,
  getOrderProgress,
  getOrderStatus,
  getPhaseName,
  getPredominantPhase,
  getPaymentStatus,
  type DemoOrder,
} from "@/lib/orders/demo-data"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"
import {
  addSupabasePayment,
  completeSupabaseOrderDelivery,
  moveSupabaseOrderItems,
} from "@/lib/orders/supabase-orders"
import { getOrderStockShortages } from "@/lib/inventory/demo-inventory"
import { useDemoInventory } from "@/lib/inventory/use-demo-inventory"
import { GarmentTraceSheet } from "@/components/orders/garment-trace-sheet"
import { Progress } from "@/components/ui/progress"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"
import { shareOrderPdf } from "@/lib/orders/share-pdf"

type PendingDelivery = {
  itemIds: string[]
  successMessage: string
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const { orders, error, loading, refresh } = useDemoOrders()
  const { inventory, error: inventoryError } = useDemoInventory()
  const operator = useOrdersOperator()
  const storedOrder = orders.find((item) => item.id === orderId) ?? null
  const order = useMemo(
    () => storedOrder
      ? { ...storedOrder, status: getOrderStatus(storedOrder) }
      : null,
    [storedOrder],
  )
  const stockShortages = useMemo(
    () => order && inventory
      ? getOrderStockShortages(orders, inventory).filter((shortage) => shortage.orderId === order.id)
      : [],
    [inventory, order, orders],
  )
  const [sheetOpen, setSheetOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Efectivo")
  const [pendingDelivery, setPendingDelivery] = useState<PendingDelivery | null>(null)
  const [deliverySubmitting, setDeliverySubmitting] = useState(false)

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  async function updateOrder(updatedOrder: DemoOrder, successMessage: string) {
    try {
      const changedItems = updatedOrder.items.filter((item, index) =>
        item.id && item.production?.currentPhase !== order?.items[index]?.production?.currentPhase,
      )
      const targetPhases = [...new Set(changedItems.map((item) => item.production?.currentPhase))]
      const targetPhase = targetPhases[0]
      if (targetPhases.length !== 1 || targetPhase === undefined) {
        throw new Error("No se pudo determinar la nueva fase de las prendas seleccionadas.")
      }
      const itemIds = changedItems.map((item) => item.id)
      if (itemIds.some((id) => !id)) throw new Error("Una prenda no tiene identificador en Supabase.")
      const validItemIds = itemIds.filter((id): id is string => Boolean(id))
      if (targetPhase === 8 && order && order.total > order.paid) {
        setPendingDelivery({ itemIds: validItemIds, successMessage })
        return true
      }
      await moveSupabaseOrderItems(
        operator.companyId,
        updatedOrder.id,
        validItemIds,
        targetPhase,
        operator.name,
      )
      await refresh()
      toast.success(successMessage)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el cambio.")
      return false
    }
  }

  async function confirmDelivery() {
    if (!order || !pendingDelivery) return
    setDeliverySubmitting(true)
    try {
      await completeSupabaseOrderDelivery(
        operator.companyId,
        order.id,
        pendingDelivery.itemIds,
        operator.name,
        paymentMethod,
      )
      await refresh()
      toast.success(`Saldo total registrado. ${pendingDelivery.successMessage}`)
      setPendingDelivery(null)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo registrar el pago y entregar las prendas.")
    } finally {
      setDeliverySubmitting(false)
    }
  }

  async function confirmPayment() {
    if (!order) return
    const amount = Number(paymentAmount)
    const outstanding = order.total - order.paid
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) {
      toast.error(`Ingresa un abono entre $1 y ${formatCurrency(outstanding)}.`)
      return
    }
    try {
      await addSupabasePayment(operator.companyId, order.id, amount, paymentMethod)
      await refresh()
      toast.success(`Abono de ${formatCurrency(amount)} registrado.`)
      setPaymentAmount("")
      setPaymentOpen(false)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "No se pudo registrar el abono.")
    }
  }

  if (loading && !order) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Cargando pedido…</p>
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-16 text-center">
        <h1 className="text-xl font-semibold">No encontramos ese pedido</h1>
        <p className="text-sm text-muted-foreground">
          El pedido no existe en la empresa activa o no tienes permisos para consultarlo.
        </p>
        <Button nativeButton={false} render={<Link href="/dashboard/orders" />} variant="outline">
          Volver a pedidos
        </Button>
      </div>
    )
  }

  const balance = Math.max(order.total - order.paid, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Link className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" href="/dashboard/orders">
            <ArrowLeftIcon className="size-3.5" /> Pedidos
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{order.id}</h1>
            <OrderStatusBadge status={getOrderStatus(order)} />
          </div>
          <p className="text-sm text-muted-foreground">{order.customer} · {order.item}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void shareOrderPdf(operator.companyId, order)}
            type="button"
            variant="outline"
          >
            <MessageCircleIcon data-icon="inline-start" /> Compartir por WhatsApp
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
          >
            <PrinterIcon data-icon="inline-start" /> Imprimir planilla
          </Button>
        </div>
      </div>

      <div className="print-area grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <div className="col-span-full hidden print:block">
          <h1 className="text-2xl font-semibold">Planilla de taller · {order.id}</h1>
          <p className="mt-1 text-sm">
            {order.customer} · {order.quantity} prendas · Entrega {formatShortDate(order.dueDate)}
          </p>
          <Separator className="mt-4" />
        </div>
        <div className="space-y-5">
          {stockShortages.length > 0 && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  Faltantes por fabricar o adquirir
                  <Badge variant="destructive">
                    {stockShortages.reduce((total, shortage) => total + shortage.missing, 0)} prendas
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Unidades de este pedido que no alcanzan a cubrirse con las existencias disponibles en la bodega asignada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stockShortages.map((shortage) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                    key={`${shortage.variantId}-${shortage.warehouse}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{shortage.product}</p>
                      <p className="text-sm text-muted-foreground">
                        {shortage.color} · Talla {shortage.size} · {shortage.warehouse}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shortage.required} requeridas · {shortage.physicalStock} en existencia
                      </p>
                    </div>
                    <Badge variant="destructive">
                      Faltan {shortage.missing}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {inventoryError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              No se pudo consultar la disponibilidad de inventario: {inventoryError}
            </p>
          )}
          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle>Trazabilidad</CardTitle>
                <CardDescription>
                  Movimientos de prendas agrupados por fase y acción. Despliega un grupo para consultar las prendas incluidas.
                </CardDescription>
              </div>
              <Badge variant="secondary">{order.timeline.length} grupos</Badge>
            </CardHeader>
            <CardContent>
              <ol className="space-y-0">
                {order.timeline.map((event, index) => (
                  <li className="relative flex gap-4 pb-6 last:pb-0" key={event.id ?? `${event.timestamp ?? event.date}-${event.title}-${index}`}>
                    {index < order.timeline.length - 1 && (
                      <span aria-hidden="true" className="absolute top-3 left-[5px] h-full w-px bg-border" />
                    )}
                    <span className={`relative mt-1.5 size-3 shrink-0 rounded-full border-2 ${index === 0 ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{event.title}</p>
                        {event.quantity !== undefined && (
                          <Badge variant="secondary">
                            {event.quantity} {event.quantity === 1 ? "prenda" : "prendas"}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <time>{event.date}</time>
                        <span>{event.operator}</span>
                      </div>
                      {event.details && event.details.length > 0 && (
                        <details className="group mt-2 rounded-md border bg-muted/20 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-medium text-primary">
                            Ver prendas del grupo ({event.details.length})
                          </summary>
                          <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                            {event.details.map((detail, detailIndex) => (
                              <li key={`${detail}-${detailIndex}`}>
                                {detailIndex + 1}. {detail}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card className="print-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle>Prendas del pedido</CardTitle>
                <CardDescription>{order.quantity} unidades · detalle por talla y personalización</CardDescription>
              </div>
              <Button onClick={() => setSheetOpen(true)} size="sm" variant="outline">
                  <ShirtIcon data-icon="inline-start" /> Ver trazabilidad de prendas
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Avance global</span>
                  <span className="font-medium tabular-nums">{getOrderProgress(order).toFixed(1)}%</span>
                </div>
                <Progress aria-label="Avance global del pedido" value={getOrderProgress(order)} />
                <Badge variant="secondary">
                  Fase predominante: {getPhaseName(getPredominantPhase(order))}
                </Badge>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Resumen financiero</CardTitle>
              <CardDescription>Valores registrados para este pedido.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(order.discountAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Descuento general</span>
                  <span className="font-medium tabular-nums">−{formatCurrency(order.discountAmount ?? 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium tabular-nums">{formatCurrency(order.total)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Abonado</span>
                <span className="font-medium tabular-nums">{formatCurrency(order.paid)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-medium">Saldo pendiente</span>
                <span className="text-lg font-semibold tabular-nums">{formatCurrency(balance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado del pago</span>
                <Badge variant={getPaymentStatus(order) === "Pagado" ? "secondary" : "outline"}>
                  {getPaymentStatus(order)}
                </Badge>
              </div>
              {order.paymentMethod && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Método de pago</span>
                  <span>{order.paymentMethod}</span>
                </div>
              )}
              {balance > 0 && (
                <Button className="w-full print-hidden" onClick={() => setPaymentOpen(true)} variant="outline">
                  <CreditCardIcon data-icon="inline-start" /> Registrar abono
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entrega y responsable</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Fecha pactada</span>
                <span>{formatShortDate(order.dueDate)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Vendedor</span>
                <span>{order.salesperson}</span>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Nota del pedido</p>
                <p>{order.note || "Sin notas registradas."}</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-full hidden print:block">
          <Card>
            <CardHeader>
              <CardTitle>Detalle de personalización</CardTitle>
              <CardDescription>Especificaciones para preparación de prendas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.items.map((item, index) => (
                <div className="grid grid-cols-7 gap-3 border-b py-2 text-xs last:border-0" key={`${item.garment}-${index}`}>
                  <span>{item.garment}</span>
                  <span>{item.color || "Azul marino"}</span>
                  <span>Talla {item.size}</span>
                  <span>{item.fit}</span>
                  <span>{item.name || "—"}</span>
                  <span>{item.number || "—"}</span>
                  <span>{item.notes || "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <GarmentTraceSheet
        onOpenChange={setSheetOpen}
        onSave={updateOrder}
        open={sheetOpen}
        order={order}
      />

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
            <DialogDescription>
              Saldo disponible: {formatCurrency(balance)}. El abono se guardará como una transacción.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            Valor del abono
            <Input
              autoFocus
              max={balance}
              min={1}
              onChange={(event) => setPaymentAmount(event.target.value)}
              placeholder="0"
              type="number"
              value={paymentAmount}
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Método de pago
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => setPaymentMethod(event.target.value)}
              value={paymentMethod}
            >
              {["Transferencia", "Efectivo", "Crédito"].map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button onClick={() => setPaymentOpen(false)} variant="outline">Cancelar</Button>
            <Button onClick={() => void confirmPayment()}>Guardar abono</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !deliverySubmitting) setPendingDelivery(null)
        }}
        open={pendingDelivery !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar pago para entregar</DialogTitle>
            <DialogDescription>
              Para pasar estas prendas a Entregado, registra el saldo total pendiente de{" "}
              <strong>{formatCurrency(balance)}</strong>. El pago y el cambio de fase se
              guardarán en una sola operación.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            Método de pago
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => setPaymentMethod(event.target.value)}
              value={paymentMethod}
            >
              {["Transferencia", "Efectivo", "Crédito"].map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button
              disabled={deliverySubmitting}
              onClick={() => setPendingDelivery(null)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button disabled={deliverySubmitting} onClick={() => void confirmDelivery()}>
              {deliverySubmitting ? "Procesando…" : "Registrar pago y entregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
