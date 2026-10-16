"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  CreditCardIcon,
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
import { upsertStoredOrder } from "@/lib/orders/demo-storage"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"
import { GarmentTraceSheet } from "@/components/orders/garment-trace-sheet"
import { Progress } from "@/components/ui/progress"

export function OrderDetail({ orderId }: { orderId: string }) {
  const { orders, error } = useDemoOrders()
  const storedOrder = orders.find((item) => item.id === orderId) ?? null
  const order = storedOrder
    ? { ...storedOrder, status: getOrderStatus(storedOrder) }
    : null
  const [sheetOpen, setSheetOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  function updateOrder(updatedOrder: DemoOrder, successMessage: string) {
    try {
      const status = getOrderStatus(updatedOrder)
      const statusChanged = status !== updatedOrder.status
      const orderToSave: DemoOrder = {
        ...updatedOrder,
        status,
        timeline: statusChanged
          ? [
              {
                date: new Intl.DateTimeFormat("es-CO", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date()),
                title: `Estado actualizado automáticamente: ${status}`,
                operator: "Sistema",
              },
              ...updatedOrder.timeline,
            ]
          : updatedOrder.timeline,
      }
      upsertStoredOrder(orderToSave)
      toast.success(statusChanged ? `${successMessage} Estado: ${status}.` : successMessage)
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el cambio.")
      return false
    }
  }

  function confirmPayment() {
    if (!order) return
    const amount = Number(paymentAmount)
    const outstanding = order.total - order.paid
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding) {
      toast.error(`Ingresa un abono entre $1 y ${formatCurrency(outstanding)}.`)
      return
    }
    updateOrder(
      {
        ...order,
        paid: order.paid + amount,
        paymentStatus: order.paid + amount >= order.total ? "Pagado" : "Abonado",
      },
      `Abono de ${formatCurrency(amount)} registrado.`,
    )
    setPaymentAmount("")
    setPaymentOpen(false)
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-16 text-center">
        <h1 className="text-xl font-semibold">No encontramos ese pedido</h1>
        <p className="text-sm text-muted-foreground">
          El pedido no existe en los datos disponibles de esta demostración.
        </p>
        <Button render={<Link href="/dashboard/orders" />} variant="outline">
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
          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div className="space-y-1">
                <CardTitle>Trazabilidad</CardTitle>
                <CardDescription>Registro cronológico de actividad y responsables.</CardDescription>
              </div>
              <Badge variant="secondary">{order.timeline.length} eventos</Badge>
            </CardHeader>
            <CardContent>
              <ol className="space-y-0">
                {order.timeline.map((event, index) => (
                  <li className="relative flex gap-4 pb-6 last:pb-0" key={`${event.date}-${event.title}`}>
                    {index < order.timeline.length - 1 && (
                      <span aria-hidden="true" className="absolute top-3 left-[5px] h-full w-px bg-border" />
                    )}
                    <span className={`relative mt-1.5 size-3 shrink-0 rounded-full border-2 ${index === 0 ? "border-primary bg-primary" : "border-muted-foreground/40 bg-background"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <time>{event.date}</time>
                        <span>{event.operator}</span>
                      </div>
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
                <div className="grid grid-cols-6 gap-3 border-b py-2 text-xs last:border-0" key={`${item.garment}-${index}`}>
                  <span>{item.garment}</span>
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
              Saldo disponible: {formatCurrency(balance)}. Este registro se guardará localmente en esta demostración.
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
          <DialogFooter>
            <Button onClick={() => setPaymentOpen(false)} variant="outline">Cancelar</Button>
            <Button onClick={confirmPayment}>Guardar abono</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
