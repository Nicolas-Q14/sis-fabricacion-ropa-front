"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  EllipsisIcon,
  ListFilterIcon,
  MessageCircleIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  garmentProductionPhases,
  getOrderProgress,
  getPaymentStatus,
  getPredominantPhase,
  getOrderStatus,
  type OrderStatus,
  type DemoOrder,
} from "@/lib/orders/demo-data"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"
import { setSupabaseOrderDeleted } from "@/lib/orders/supabase-orders"
import { shareOrderPdf } from "@/lib/orders/share-pdf"
import { useOrdersOperator } from "@/components/orders/orders-operator-context"

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

function filterOrders(
  orders: DemoOrder[],
  query: string,
  statusFilter: string,
  paymentFilter: string,
) {
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
  const { orders, trashedOrders, error, loading, refresh } = useDemoOrders()
  const { companyId } = useOrdersOperator()
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("Todos")
  const [paymentFilter, setPaymentFilter] = useState("Todos")
  const [orderToTrash, setOrderToTrash] = useState<DemoOrder | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<DemoOrder | null>(null)

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  const filteredOrders = useMemo(
    () => filterOrders(orders, query, statusFilter, paymentFilter),
    [orders, paymentFilter, query, statusFilter],
  )
  const filteredTrashedOrders = useMemo(
    () => filterOrders(trashedOrders, query, statusFilter, paymentFilter),
    [trashedOrders, paymentFilter, query, statusFilter],
  )

  async function moveOrder(order: DemoOrder) {
    try {
      await setSupabaseOrderDeleted(companyId, order.id, "trash")
      await refresh()
      setOrderToTrash(null)
      toast.success(`El pedido ${order.id} se movió a la papelera.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo mover el pedido a la papelera.")
    }
  }

  async function restoreOrder(order: DemoOrder) {
    try {
      await setSupabaseOrderDeleted(companyId, order.id, "restore")
      await refresh()
      toast.success(`El pedido ${order.id} se restauró.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo restaurar el pedido.")
    }
  }

  async function archiveOrder(order: DemoOrder) {
    try {
      await setSupabaseOrderDeleted(companyId, order.id, "archive")
      await refresh()
      setOrderToDelete(null)
      toast.success(`El pedido ${order.id} se archivó y se conservó su historial.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el pedido.")
    }
  }

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
        <Button nativeButton={false} render={<Link href="/dashboard/orders/new" />}>
          <PlusIcon data-icon="inline-start" />
          Nuevo pedido
        </Button>
      </div>

      <div
        className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        role="note"
      >
        Los pedidos y sus cambios se sincronizan con Supabase en la empresa activa.
      </div>

      <Tabs defaultValue="activos" className="gap-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <TabsList>
            <TabsTrigger value="activos">Pedidos activos ({orders.length})</TabsTrigger>
            <TabsTrigger value="papelera">Papelera ({trashedOrders.length})</TabsTrigger>
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

        <TabsContent value="activos">
          {loading && <p className="pb-3 text-sm text-muted-foreground">Sincronizando pedidos…</p>}
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
                            <DropdownMenuItem onClick={() => void shareOrderPdf(companyId, order)}>
                              <MessageCircleIcon />
                              Compartir por WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              void navigator.clipboard.writeText(order.id).then(
                                () => toast.success("Número de pedido copiado."),
                                () => toast.error("No se pudo copiar el número de pedido."),
                              )
                            }}>
                              Copiar número
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setOrderToTrash(order)}
                            >
                              <Trash2Icon />
                              Mover a la papelera
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

        <TabsContent value="papelera">
          {loading && <p className="pb-3 text-sm text-muted-foreground">Sincronizando pedidos…</p>}
          <Card className="gap-0 py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {`${filteredTrashedOrders.length} pedidos en la papelera`}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Los pedidos eliminados se conservan aquí hasta restaurarlos o archivarlos.
              </p>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Prenda principal</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrashedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell className="max-w-52 truncate">{order.customer}</TableCell>
                    <TableCell>{order.item}</TableCell>
                    <TableCell className="text-right tabular-nums">{order.quantity}</TableCell>
                    <TableCell><OrderStatusBadge status={getOrderStatus(order)} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => void restoreOrder(order)}
                          size="sm"
                          variant="outline"
                        >
                          <RotateCcwIcon data-icon="inline-start" />
                          Restaurar
                        </Button>
                        {order.archivedAt ? (
                          <Badge variant="outline">Archivado</Badge>
                        ) : (
                          <Button
                            aria-label={`Archivar el pedido ${order.id}`}
                            onClick={() => setOrderToDelete(order)}
                            size="icon-sm"
                            variant="destructive"
                          >
                            <Trash2Icon />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTrashedOrders.length === 0 && (
                  <TableRow>
                    <TableCell className="h-28 text-center text-muted-foreground" colSpan={6}>
                      La papelera está vacía o no hay pedidos que coincidan con estos filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={orderToTrash !== null} onOpenChange={(open) => {
        if (!open) setOrderToTrash(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover pedido a la papelera</DialogTitle>
            <DialogDescription>
              {orderToTrash
                ? `El pedido ${orderToTrash.id} dejará de aparecer en las listas activas. Podrás restaurarlo desde la papelera cuando quieras.`
                : "El pedido dejará de aparecer en las listas activas y podrás restaurarlo desde la papelera."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOrderToTrash(null)} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (orderToTrash) void moveOrder(orderToTrash)
              }}
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              Mover a la papelera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={orderToDelete !== null} onOpenChange={(open) => {
        if (!open) setOrderToDelete(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archivar pedido</DialogTitle>
            <DialogDescription>
              {orderToDelete
                ? `El pedido ${orderToDelete.id} se marcará como archivado. Se conservará su historial y no podrá restaurarse desde la aplicación.`
                : "El pedido se archivará y se conservará su historial."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setOrderToDelete(null)} variant="outline">
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (orderToDelete) void archiveOrder(orderToDelete)
              }}
              variant="destructive"
            >
              <Trash2Icon data-icon="inline-start" />
              Archivar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
