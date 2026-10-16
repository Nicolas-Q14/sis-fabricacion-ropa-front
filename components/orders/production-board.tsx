"use client"

import { useEffect, useState } from "react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarDaysIcon, GripVerticalIcon, ShirtIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"
import {
  formatShortDate,
  garmentProductionPhases,
  getOrderProgress,
  getOrderStatus,
  getPhaseDistributionSummary,
  getPredominantPhase,
  updateGarmentProductionForOrderMove,
  type DemoOrder,
  type GarmentPhaseReached,
} from "@/lib/orders/demo-data"
import { upsertStoredOrder } from "@/lib/orders/demo-storage"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"

const phaseColors = {
  1: {
    column: "border-sky-300 bg-sky-100 text-sky-950",
    badge: "border-sky-300 bg-sky-100 text-sky-900",
    accent: "border-l-sky-400",
  },
  2: {
    column: "border-orange-300 bg-orange-100 text-orange-950",
    badge: "border-orange-300 bg-orange-100 text-orange-900",
    accent: "border-l-orange-400",
  },
  3: {
    column: "border-lime-300 bg-lime-100 text-lime-950",
    badge: "border-lime-300 bg-lime-100 text-lime-900",
    accent: "border-l-lime-400",
  },
  4: {
    column: "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-950",
    badge: "border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900",
    accent: "border-l-fuchsia-400",
  },
  5: {
    column: "border-green-300 bg-green-100 text-green-950",
    badge: "border-green-300 bg-green-100 text-green-900",
    accent: "border-l-green-400",
  },
  6: {
    column: "border-yellow-300 bg-yellow-100 text-yellow-950",
    badge: "border-yellow-300 bg-yellow-100 text-yellow-900",
    accent: "border-l-yellow-400",
  },
  7: {
    column: "border-teal-300 bg-teal-100 text-teal-950",
    badge: "border-teal-300 bg-teal-100 text-teal-900",
    accent: "border-l-teal-400",
  },
  8: {
    column: "border-emerald-300 bg-emerald-100 text-emerald-950",
    badge: "border-emerald-300 bg-emerald-100 text-emerald-900",
    accent: "border-l-emerald-400",
  },
} as const

type PendingMove = {
  order: DemoOrder
  targetPhase: GarmentPhaseReached
}

export function ProductionBoard() {
  const { orders, error } = useDemoOrders()
  const operator = useOrdersOperator()
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return
    const order = orders.find((candidate) => candidate.id === String(active.id))
    const targetColumn = String(over.id)
    const targetOrder = orders.find((candidate) => candidate.id === targetColumn)
    const targetPhase = targetColumn.startsWith("phase-")
      ? Number(targetColumn.slice("phase-".length))
      : targetOrder
        ? getPredominantPhase(targetOrder)
        : Number.NaN
    if (!order || !Number.isInteger(targetPhase) || targetPhase < 0 || targetPhase > 8) return
    if (order.items.every((item) => (item.production?.currentPhase ?? 0) === targetPhase)) return
    setPendingMove({ order, targetPhase: targetPhase as GarmentPhaseReached })
  }

  function confirmMove() {
    if (!pendingMove) return
    try {
      const updatedOrder: DemoOrder = {
        ...pendingMove.order,
        items: pendingMove.order.items.map((item) =>
          updateGarmentProductionForOrderMove(item, pendingMove.targetPhase, operator),
        ),
        timeline: [
          {
            date: new Intl.DateTimeFormat("es-CO", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date()),
            title: `Todas las prendas movidas a ${phaseName(pendingMove.targetPhase)} desde el tablero de producción`,
            operator: operator.name,
          },
          ...pendingMove.order.timeline,
        ],
      }
      updatedOrder.status = getOrderStatus(updatedOrder)
      upsertStoredOrder(updatedOrder)
      toast.success(
        `${updatedOrder.items.length} prendas actualizadas a ${phaseName(pendingMove.targetPhase)}.`,
      )
      setPendingMove(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la fase del pedido.")
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Operación / Producción</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tablero de producción</h1>
        <p className="text-sm text-muted-foreground">
          Arrastra un pedido a otra fase para actualizar todas sus prendas y registrar la trazabilidad.
        </p>
      </div>
      <div
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        role="note"
      >
        Tablero de demostración: la trazabilidad se guarda localmente en este navegador.
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
        <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6">
          <div className="flex min-w-max items-start gap-4">
            <ProductionColumn
              count={orders.filter((order) => getPredominantPhase(order) === 0).length}
              emptyMessage="No hay pedidos sin iniciar"
              id="phase-0"
              title="Sin iniciar"
              subtitle="Pendiente de comenzar"
              orders={orders.filter((order) => getPredominantPhase(order) === 0)}
            />
            {garmentProductionPhases.map((phase) => {
              const phaseOrders = orders.filter((order) => getPredominantPhase(order) === phase.id)
              const colors = phaseColors[phase.id]
              return (
                <ProductionColumn
                  colors={colors}
                  count={phaseOrders.length}
                  emptyMessage="No hay pedidos en esta fase predominante"
                  id={`phase-${phase.id}`}
                  key={phase.id}
                  orders={phaseOrders}
                  subtitle={phase.name}
                  title={`Fase ${phase.id}`}
                />
              )
            })}
          </div>
        </div>
      </DndContext>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setPendingMove(null)
        }}
        open={pendingMove !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cambio de fase</DialogTitle>
            <DialogDescription>
              ¿Está seguro de cambiar todas las unidades del pedido{" "}
              <strong>{pendingMove?.order.id}</strong> a{" "}
              <strong>{pendingMove ? phaseName(pendingMove.targetPhase) : ""}</strong>?
              Se completarán automáticamente las fases intermedias y quedarán registradas
              en la trazabilidad de cada prenda con su usuario y fecha.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingMove(null)} variant="outline">
              Cancelar
            </Button>
            <Button onClick={confirmMove}>Sí, cambiar todas las prendas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function phaseName(phase: GarmentPhaseReached) {
  return phase === 0 ? "Sin iniciar" : garmentProductionPhases[phase - 1].name
}

function ProductionColumn({
  count,
  emptyMessage,
  id,
  orders,
  subtitle,
  title,
  colors,
}: {
  count: number
  emptyMessage: string
  id: string
  orders: DemoOrder[]
  subtitle: string
  title: string
  colors?: (typeof phaseColors)[keyof typeof phaseColors]
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <section
      aria-label={`${title}: ${count} pedidos`}
      className={`w-[min(82vw,320px)] shrink-0 rounded-xl p-3 transition-colors ${
        isOver ? "bg-primary/10 ring-2 ring-primary/40" : "bg-muted/40"
      }`}
      ref={setNodeRef}
    >
      <div className={`mb-3 flex items-center justify-between gap-2 rounded-md border p-2 ${
        colors?.column ?? "border-slate-300 bg-slate-100 text-slate-950"
      }`}>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="truncate text-xs opacity-80">{subtitle}</p>
        </div>
        <Badge className={colors?.badge} variant="outline">{count}</Badge>
      </div>
      <div className="min-h-20 space-y-3">
        {orders.map((order) => <ProductionOrderCard key={order.id} order={order} />)}
        {orders.length === 0 && (
          <div className="rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  )
}

function ProductionOrderCard({ order }: { order: DemoOrder }) {
  const router = useRouter()
  const progress = getOrderProgress(order)
  const predominantPhase = getPredominantPhase(order)
  const distribution = getPhaseDistributionSummary(order)
  const colors = predominantPhase ? phaseColors[predominantPhase] : null
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    disabled: order.items.length === 0,
  })

  return (
    <div
      className={isDragging ? "opacity-40" : undefined}
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <Card className={`gap-3 border-l-4 py-3 ${colors?.accent ?? "border-l-slate-300"}`}>
        <CardHeader className="gap-2 px-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button
                aria-label={`Arrastrar pedido ${order.id} a otra fase`}
                className="touch-none cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                type="button"
                {...attributes}
                {...listeners}
              >
                <GripVerticalIcon className="size-4" />
              </button>
              <button
                className="truncate font-semibold hover:underline"
                onClick={() => router.push(`/dashboard/orders/${encodeURIComponent(order.id)}`)}
                type="button"
              >
                {order.id}
              </button>
            </div>
            <Badge className={colors?.badge} variant="outline">
              {predominantPhase
                ? `Fase ${predominantPhase} · ${garmentProductionPhases[predominantPhase - 1].name}`
                : "Sin iniciar"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Avatar size="sm">
              <AvatarFallback>{order.customer.slice(0, 2).toLocaleUpperCase("es")}</AvatarFallback>
            </Avatar>
            <span className="truncate">{order.customer}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDaysIcon className="size-3.5" />
              Entrega {formatShortDate(order.dueDate)}
            </span>
            <span>{order.items.length} prendas</span>
          </div>
          <Tooltip>
            <TooltipTrigger className="block w-full cursor-help text-left">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avance global</span>
                  <span className="font-medium tabular-nums">{progress.toFixed(1)}%</span>
                </div>
                <Progress aria-label={`Avance global del pedido ${order.id}`} value={progress} />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              {distribution || "No hay prendas registradas."}
            </TooltipContent>
          </Tooltip>
          <Button
            className="w-full"
            onClick={() => router.push(`/dashboard/orders/${encodeURIComponent(order.id)}`)}
            size="sm"
            variant="outline"
          >
            <ShirtIcon data-icon="inline-start" /> Ver trazabilidad de prendas
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
