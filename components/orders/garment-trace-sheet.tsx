"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  CheckCheckIcon,
  ChevronRightIcon,
  Clock3Icon,
  FolderIcon,
  RotateCcwIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  garmentProductionPhases,
  getGarmentPhase,
  getPhaseName,
  type DemoOrder,
  type GarmentPhaseReached,
  type PhaseHistoryEvent,
  isGarmentPhaseReached,
  updateGarmentProduction,
} from "@/lib/orders/demo-data"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"

function getPhaseHistory(item: DemoOrder["items"][number]): PhaseHistoryEvent[] {
  const history = item.production?.history
  if (history?.length) return history

  return (item.production?.verifications ?? []).map((verification) => ({
    id: `verification-${verification.phase}`,
    eventType: "avance",
    previousPhase: (verification.phase - 1) as GarmentPhaseReached,
    phase: verification.phase,
    userId: verification.userId,
    operator: verification.operator,
    verifiedAt: verification.verifiedAt,
    observation: null,
  }))
}

export function GarmentTraceSheet({
  order,
  onOpenChange,
  onSave,
  open,
}: {
  order: DemoOrder
  onOpenChange: (open: boolean) => void
  onSave: (order: DemoOrder, message: string) => Promise<boolean>
  open: boolean
}) {
  const operator = useOrdersOperator()
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set())
  const [bulkTarget, setBulkTarget] = useState<GarmentPhaseReached>(0)
  const [timelineItem, setTimelineItem] = useState<{
    item: DemoOrder["items"][number]
    index: number
  } | null>(null)
  const allSelected = order.items.length > 0 && selectedRows.size === order.items.length
  const phaseGroups = [
    { id: 0 as const, name: "Sin iniciar" },
    ...garmentProductionPhases,
  ].map((phase) => {
    const items = order.items.flatMap((item, index) =>
      getGarmentPhase(item) === phase.id ? [{ item, index }] : [],
    )
    const verifiedCount = items.filter(({ item }) =>
      item.production?.verifications.some((verification) => verification.phase === phase.id),
    ).length
    return { ...phase, items, verifiedCount }
  }).filter((phase) => phase.items.length > 0)
  const timelineEvents = timelineItem ? getPhaseHistory(timelineItem.item) : []

  async function updateSelectedRows(indices: number[], targetPhase: GarmentPhaseReached) {
    try {
      const updatedOrder = {
        ...order,
        items: order.items.map((item, index) => indices.includes(index)
          ? updateGarmentProduction(item, targetPhase, operator)
          : item),
      }
      return await onSave(updatedOrder, `Trazabilidad actualizada para ${indices.length} prendas.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la fase de producción.")
      return false
    }
  }

  async function applyBulkPhase() {
    if (selectedRows.size === 0) {
      toast.error("Selecciona al menos una prenda.")
      return
    }
    const selectedIndices = [...selectedRows]
    if (await updateSelectedRows(selectedIndices, bulkTarget)) setSelectedRows(new Set())
  }

  function toggleRow(index: number, checked: boolean | "indeterminate") {
    setSelectedRows((current) => {
      const next = new Set(current)
      if (checked === true) next.add(index)
      else next.delete(index)
      return next
    })
  }

  function formatVerifiedAt(value: string) {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  }

  return (
    <Sheet
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setSelectedRows(new Set())
        onOpenChange(nextOpen)
      }}
      open={open}
    >
      <SheetContent className="w-[min(98vw,1600px)] max-w-none overflow-y-auto sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Trazabilidad de prendas · {order.id}</SheetTitle>
          <SheetDescription>
            Registra cada verificación por prenda. Las fases se completan secuencialmente y guardan operario y fecha automáticamente.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Acción masiva</p>
              <Select
                value={String(bulkTarget)}
                onValueChange={(value) => {
                  const phase = Number(value)
                  if (isGarmentPhaseReached(phase)) setBulkTarget(phase)
                }}
              >
                <SelectTrigger aria-label="Fase de destino para las prendas seleccionadas" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sin iniciar</SelectItem>
                  {garmentProductionPhases.map((phase) => (
                    <SelectItem
                      disabled={phase.id > Math.min(...[...selectedRows].map((index) => getGarmentPhase(order.items[index]) + 1))}
                      key={phase.id}
                      value={String(phase.id)}
                    >
                      Fase {phase.id} · {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full sm:w-auto"
              disabled={selectedRows.size === 0}
              onClick={() => void applyBulkPhase()}
              type="button"
            >
              <CheckCheckIcon data-icon="inline-start" />
              {selectedRows.size
                ? `Actualizar ${selectedRows.size} prendas`
                : "Selecciona prendas"}
            </Button>
          </div>

          {phaseGroups.length === 0 ? (
            <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
              Este pedido todavía no tiene prendas registradas.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-end">
                <Checkbox
                  aria-label="Seleccionar todas las prendas"
                  checked={allSelected}
                  onCheckedChange={(checked) => setSelectedRows(
                    checked === true
                      ? new Set(order.items.map((_, index) => index))
                      : new Set(),
                  )}
                />
                <span className="ml-2 text-xs text-muted-foreground">Seleccionar todas</span>
              </div>
              {phaseGroups.map((group) => (
                <details
                  className="group rounded-lg border bg-background"
                  key={group.id}
                  open={group.id === 0}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-3 hover:bg-muted/50">
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                    <FolderIcon className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {group.id === 0 ? group.name : `Fase ${group.id} · ${group.name}`}
                    </span>
                    <Badge variant="secondary">
                      {group.verifiedCount}/{order.items.length} verificadas
                    </Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {group.items.length} {group.items.length === 1 ? "prenda" : "prendas"} en esta fase
                    </span>
                  </summary>
                  <div className="overflow-x-auto border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">Sel.</TableHead>
                          <TableHead>Prenda</TableHead>
                          <TableHead>Referencia</TableHead>
                          <TableHead>Fase alcanzada</TableHead>
                          <TableHead className="min-w-36">Avance</TableHead>
                          <TableHead>Línea de tiempo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map(({ item, index }) => {
                          const phase = getGarmentPhase(item)
                          const progress = phase / garmentProductionPhases.length * 100
                          return (
                            <TableRow key={`${item.garment}-${item.size}-${item.number}-${index}`}>
                              <TableCell>
                                <Checkbox
                                  aria-label={`Seleccionar ${item.garment} talla ${item.size}`}
                                  checked={selectedRows.has(index)}
                                  onCheckedChange={(checked) => toggleRow(index, checked)}
                                />
                              </TableCell>
                              <TableCell className="min-w-40">
                                <p className="font-medium">{item.garment} · {item.color || "Azul marino"} · Talla {item.size || "—"}</p>
                                <p className="text-xs text-muted-foreground">{item.fit}</p>
                                {item.name && <p className="text-xs">{item.name}</p>}
                              </TableCell>
                              <TableCell className="min-w-28 text-sm">
                                {item.number ? `N.º ${item.number}` : "—"}
                              </TableCell>
                              <TableCell className="min-w-60">
                                <Select
                                  value={String(phase)}
                                  onValueChange={(value) => {
                                    const nextPhase = Number(value)
                                    if (!isGarmentPhaseReached(nextPhase)) return
                                    void updateSelectedRows([index], nextPhase)
                                  }}
                                >
                                  <SelectTrigger aria-label={`Fase actual de prenda ${index + 1}`} className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">Sin iniciar</SelectItem>
                                    {garmentProductionPhases.map((phaseOption) => (
                                      <SelectItem
                                        disabled={phaseOption.id > phase + 1}
                                        key={phaseOption.id}
                                        value={String(phaseOption.id)}
                                      >
                                        Fase {phaseOption.id} · {phaseOption.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-xs">
                                    <span>{phase ? `Fase ${phase}/${garmentProductionPhases.length}` : "Sin iniciar"}</span>
                                    <span className="tabular-nums">{progress.toFixed(1)}%</span>
                                  </div>
                                  <Progress aria-label={`Avance de prenda ${index + 1}`} value={progress} />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  onClick={() => setTimelineItem({ item, index })}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <Clock3Icon data-icon="inline-start" />
                                  Ver detalle
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        <Dialog
          open={Boolean(timelineItem)}
          onOpenChange={(nextOpen) => !nextOpen && setTimelineItem(null)}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Línea de tiempo detallada</DialogTitle>
              <DialogDescription>
                {timelineItem
                  ? `${timelineItem.item.garment} · ${timelineItem.item.color || "Azul marino"} · Talla ${timelineItem.item.size || "—"}${timelineItem.item.number ? ` · N.º ${timelineItem.item.number}` : ""} · Pedido ${order.id}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {timelineItem && (
              <>
                {getGarmentPhase(timelineItem.item) === 0 && (
                  <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Pedido registrado · La prenda aún no inicia su recorrido por las fases de producción.
                  </p>
                )}
                {getGarmentPhase(timelineItem.item) > 0 && (
                  <p className="rounded-md border bg-muted/30 p-3 text-xs">
                    Fase actual: <span className="font-medium">{getPhaseName(getGarmentPhase(timelineItem.item))}</span>
                  </p>
                )}
                <ol className="space-y-0">
                  {timelineEvents.map((event, index) => {
                    const phaseName = event.phase === 0
                      ? "Sin iniciar"
                      : garmentProductionPhases.find((phase) => phase.id === event.phase)?.name ?? "Fase desconocida"
                    return (
                      <li className="relative flex gap-3 pb-5 last:pb-0" key={event.id}>
                        {index < timelineEvents.length - 1 && (
                          <span aria-hidden="true" className="absolute top-7 left-[11px] h-full w-px bg-border" />
                        )}
                        <span className={`relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${event.eventType === "avance" ? "border-primary bg-primary text-primary-foreground" : "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>
                          {event.eventType === "avance"
                            ? <CheckCheckIcon className="size-3.5" />
                            : <RotateCcwIcon className="size-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {event.eventType === "retroceso"
                                ? `Retroceso de ${getPhaseName(event.previousPhase)} a ${phaseName}`
                                : `Avance a ${phaseName}`}
                            </p>
                            <Badge variant={event.eventType === "avance" ? "secondary" : "outline"}>
                              {event.eventType === "avance" ? "Avance" : "Retroceso"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Avatar size="sm">
                              <AvatarFallback>
                                {event.operator.slice(0, 2).toLocaleUpperCase("es")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">{event.operator}</p>
                              <Tooltip>
                                <TooltipTrigger className="block truncate text-left text-[11px] text-muted-foreground">
                                  {formatVerifiedAt(event.verifiedAt)}
                                </TooltipTrigger>
                                <TooltipContent>
                                  Usuario: {event.userId || "No disponible"} · {formatVerifiedAt(event.verifiedAt)}
                                </TooltipContent>
                              </Tooltip>
                              {event.observation && (
                                <p className="mt-1 text-xs text-muted-foreground">{event.observation}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                  {timelineEvents.length === 0 && getGarmentPhase(timelineItem.item) > 0 && (
                    <li className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-muted-foreground">
                        <Clock3Icon className="size-3.5" />
                      </span>
                      <p className="text-xs text-muted-foreground">
                        No hay eventos históricos detallados para esta prenda.
                      </p>
                    </li>
                  )}
                  {garmentProductionPhases
                    .filter((phase) => phase.id > getGarmentPhase(timelineItem.item))
                    .map((phase) => (
                      <li className="relative flex gap-3 pb-5 last:pb-0" key={`pending-${phase.id}`}>
                        <span className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
                          <span className="size-1.5 rounded-full bg-current" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">Fase {phase.id} · {phase.name}</p>
                          <Badge className="mt-1" variant="outline">Pendiente</Badge>
                        </div>
                      </li>
                    ))}
                </ol>
              </>
            )}
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}
