"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CheckCheckIcon, ListChecksIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  isGarmentPhaseReached,
  updateGarmentProduction,
} from "@/lib/orders/demo-data"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"

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
  const allSelected = order.items.length > 0 && selectedRows.size === order.items.length

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

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Seleccionar todas las prendas"
                      checked={allSelected}
                      onCheckedChange={(checked) => setSelectedRows(
                        checked === true
                          ? new Set(order.items.map((_, index) => index))
                          : new Set(),
                      )}
                    />
                  </TableHead>
                  <TableHead>Prenda</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Fase alcanzada</TableHead>
                  <TableHead className="min-w-36">Avance</TableHead>
                  <TableHead>Verificaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item, index) => {
                  const phase = getGarmentPhase(item)
                  const progress = phase / garmentProductionPhases.length * 100
                  const verifications = item.production?.verifications ?? []
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
                      <TableCell className="min-w-64">
                        {verifications.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sin verificaciones</span>
                        ) : (
                          <details className="group">
                            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium">
                              <ListChecksIcon className="size-4 text-muted-foreground" />
                              {verifications.length} de {garmentProductionPhases.length} fases verificadas
                            </summary>
                            <ul className="mt-2 space-y-2">
                              {verifications.map((verification) => (
                                <li className="flex items-center gap-2" key={verification.phase}>
                                  <Avatar size="sm">
                                    <AvatarFallback>
                                      {verification.operator.slice(0, 2).toLocaleUpperCase("es")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium">
                                      Fase {verification.phase}: {getPhaseName(verification.phase)}
                                    </p>
                                    <Tooltip>
                                      <TooltipTrigger className="block truncate text-left text-[11px] text-muted-foreground">
                                        {verification.operator} · {formatVerifiedAt(verification.verifiedAt)}
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Usuario: {verification.userId} · {formatVerifiedAt(verification.verifiedAt)}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  <Badge className="ml-auto shrink-0" variant="secondary">Lista</Badge>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {order.items.length === 0 && (
                  <TableRow>
                    <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                      Este pedido todavía no tiene prendas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
