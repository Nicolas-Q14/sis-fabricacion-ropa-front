"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  EllipsisIcon,
  ListFilterIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  formatShortDate,
  garmentProductionPhases,
  getOrderProgress,
  getPaymentStatus,
  getPredominantPhase,
  getOrderStatus,
  type OrderStatus,
  type DemoOrder,
} from "@/lib/orders/demo-data"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"

const statusTone: Record<OrderStatus, string> = {
  Diseño: "border-sky-200 bg-sky-50 text-sky-800",
  "Interpretación de Orden / Taller": "border-cyan-200 bg-cyan-50 text-cyan-800",
  "Revisión de Papel": "border-indigo-200 bg-indigo-50 text-indigo-800",
  "Corte Tela y Organizar Tela para Sublimar": "border-amber-200 bg-amber-50 text-amber-800",
  Sublimación: "border-violet-200 bg-violet-50 text-violet-800",
  "Revisión de Piezas / Producto Terminado": "border-purple-200 bg-purple-50 text-purple-800",
  "Control de calidad": "border-orange-200 bg-orange-50 text-orange-800",
  Entregado: "border-emerald-200 bg-emerald-50 text-emerald-800",
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={statusTone[status]}>
      {status}
    </Badge>
  )
}

export function OrdersList() {
  const router = useRouter()
  const { orders, error } = useDemoOrders()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("Todos")
  const [paymentFilter, setPaymentFilter] = useState("Todos")

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es")
    return orders.filter((order) => {
      const matchesQuery = `${order.id} ${order.customer} ${order.item}`
        .toLocaleLowerCase("es")
        .includes(normalizedQuery)
      const matchesStatus = statusFilter === "Todos" || getOrderStatus(order) === statusFilter
      const matchesPayment = paymentFilter === "Todos"
        || getPaymentStatus(order) === paymentFilter
      return matchesQuery && matchesStatus && matchesPayment
    })
  }, [orders, paymentFilter, query, statusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Operación / Pedidos</p>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Consulta el estado de cada pedido sin perder de vista lo importante.
          </p>
        </div>
        <Button render={<Link href="/dashboard/orders/new" />}>
          <PlusIcon data-icon="inline-start" />
          Nuevo pedido
        </Button>
      </div>

      <div
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        role="note"
      >
        Datos de demostración: los cambios se guardan en este navegador y todavía no se sincronizan con Supabase.
      </div>

      <Tabs defaultValue="tabla" className="gap-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <TabsList>
            <TabsTrigger value="tabla">Vista tabla</TabsTrigger>
            <TabsTrigger value="kanban">Vista Kanban</TabsTrigger>
          </TabsList>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_160px]">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Buscar por pedido, cliente o prenda"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar pedido o cliente…"
                value={query}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
              <SelectTrigger aria-label="Filtrar por estado de producción" className="w-full">
                <ListFilterIcon className="size-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos los estados</SelectItem>
                {garmentProductionPhases.map(({ name }) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={(value) => value && setPaymentFilter(value)}>
              <SelectTrigger aria-label="Filtrar por estado de pago" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Todos", "Pendiente", "Abonado", "Pagado"].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === "Todos" ? "Todos los pagos" : `Pago ${status.toLowerCase()}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="tabla">
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {`${filteredOrders.length} pedidos`}
              </CardTitle>
            </CardHeader>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Prenda principal</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead>Avance</TableHead>
                    <TableHead>Fase predominante</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow
                      className="cursor-pointer"
                      key={order.id}
                      onClick={() => router.push(`/dashboard/orders/${encodeURIComponent(order.id)}`)}
                    >
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell className="max-w-52 truncate">{order.customer}</TableCell>
                      <TableCell>{order.item}</TableCell>
                      <TableCell className="text-right tabular-nums">{order.quantity}</TableCell>
                      <TableCell className="min-w-32">
                        <div className="flex items-center gap-2">
                          <Progress
                            aria-label={`Avance global del pedido ${order.id}`}
                            className="w-16"
                            value={getOrderProgress(order)}
                          />
                          <span className="text-xs tabular-nums">{getOrderProgress(order).toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getPredominantPhase(order) === 0
                            ? "Sin iniciar"
                            : `Fase ${getPredominantPhase(order)} · ${garmentProductionPhases[getPredominantPhase(order) - 1]?.name}`}
                        </Badge>
                      </TableCell>
                      <TableCell><OrderStatusBadge status={getOrderStatus(order)} /></TableCell>
                      <TableCell onClick={(event) => event.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            aria-label={`Acciones para ${order.id}`}
                            render={<Button variant="ghost" size="icon-sm" />}
                          >
                            <EllipsisIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/orders/${encodeURIComponent(order.id)}`)}>
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              void navigator.clipboard.writeText(order.id).then(
                                () => toast.success("Número de pedido copiado."),
                                () => toast.error("No se pudo copiar el número de pedido."),
                              )
                            }}>
                              Copiar número
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredOrders.length === 0 && (
                    <TableRow>
                      <TableCell className="h-28 text-center text-muted-foreground" colSpan={8}>
                        No hay pedidos que coincidan con estos filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="kanban">
          <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6">
            <div className="flex min-w-max items-start gap-4">
              <section className="w-[min(82vw,320px)] shrink-0 rounded-xl border bg-muted/30 p-3" key="sin-iniciar">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div>
                    <h2 className="text-sm font-semibold">Sin iniciar</h2>
                    <p className="text-xs text-muted-foreground">Pendiente de comenzar</p>
                  </div>
                  <Badge variant="secondary">
                    {filteredOrders.filter((order) => getPredominantPhase(order) === 0).length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {filteredOrders.filter((order) => getPredominantPhase(order) === 0).map((order) => (
                    <OrderKanbanCard key={order.id} order={order} onOpen={() => router.push(`/dashboard/orders/${encodeURIComponent(order.id)}`)} />
                  ))}
                </div>
              </section>
              {garmentProductionPhases.map((stage) => {
                const stageOrders = filteredOrders.filter((order) => getPredominantPhase(order) === stage.id)
                return (
                  <section className="w-[min(82vw,320px)] shrink-0 rounded-xl border bg-muted/30 p-3" key={stage.id}>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div>
                        <h2 className="text-sm font-semibold">Fase {stage.id}</h2>
                        <p className="text-xs text-muted-foreground">{stage.name}</p>
                      </div>
                      <Badge variant="secondary">{stageOrders.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {stageOrders.map((order) => (
                        <OrderKanbanCard
                          key={order.id}
                          onOpen={() => router.push(`/dashboard/orders/${encodeURIComponent(order.id)}`)}
                          order={order}
                        />
                      ))}
                      {stageOrders.length === 0 && (
                        <p className="rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
                          Sin pedidos en esta fase predominante
                        </p>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OrderKanbanCard({
  onOpen,
  order,
}: {
  onOpen: () => void
  order: DemoOrder
}) {
  return (
    <button
      className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
      onClick={onOpen}
      type="button"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{order.id}</span>
        <OrderStatusBadge status={getOrderStatus(order)} />
      </div>
      <p className="mt-2 truncate text-sm">{order.customer}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {order.quantity} prendas · entrega {formatShortDate(order.dueDate)}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Avance global</span>
        <span className="font-medium tabular-nums">{getOrderProgress(order).toFixed(1)}%</span>
      </div>
      <Progress className="mt-1.5" value={getOrderProgress(order)} />
    </button>
  )
}
