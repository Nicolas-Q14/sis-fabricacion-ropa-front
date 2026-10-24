"use client"

import { useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { InventorySummary } from "@/components/inventory/inventory-summary"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { appRoleLabels, type AppRole, type CompanyOption } from "@/lib/auth/roles"
import { SearchIcon } from "lucide-react"
import { OrdersOperatorProvider } from "@/components/orders/orders-operator-context"
import { getLowStockVariants } from "@/lib/inventory/demo-inventory"
import { useDemoInventory } from "@/lib/inventory/use-demo-inventory"
import { getGarmentPhase, garmentProductionPhases } from "@/lib/orders/demo-data"
import { useDemoOrders } from "@/lib/orders/use-demo-orders"

export function DashboardClient({
  companies,
  companyId,
  companyName,
  email,
  fullName,
  avatarUrl,
  operatorId,
  role,
}: {
  companies: CompanyOption[]
  companyId: string
  companyName: string | null
  email: string
  fullName: string
  avatarUrl: string | null
  operatorId: string
  role: AppRole
}) {
  return (
    <OrdersOperatorProvider
      companyId={companyId}
      operator={{ userId: operatorId, name: fullName.trim() || email || "Tu cuenta" }}
    >
      <DashboardContent
        companies={companies}
        companyId={companyId}
        companyName={companyName}
        email={email}
        fullName={fullName}
        avatarUrl={avatarUrl}
        role={role}
      />
    </OrdersOperatorProvider>
  )
}

function DashboardContent({
  companies,
  companyId,
  companyName,
  email,
  fullName,
  avatarUrl,
  role,
}: {
  companies: CompanyOption[]
  companyId: string
  companyName: string | null
  email: string
  fullName: string
  avatarUrl: string | null
  role: AppRole
}) {
  const displayName = fullName.trim() || email || "Tu cuenta"
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("Todos")
  const { orders, error: ordersError, loading: ordersLoading } = useDemoOrders()
  const { inventory, error: inventoryError } = useDemoInventory()
  const lowStock = inventory ? getLowStockVariants(inventory) : []
  const availableStatuses = [...new Set(orders.map((order) => order.status))].sort()
  const today = new Date()
  const dueSoon = new Date(today)
  dueSoon.setDate(dueSoon.getDate() + 3)
  const dueSoonString = [
    dueSoon.getFullYear(),
    String(dueSoon.getMonth() + 1).padStart(2, "0"),
    String(dueSoon.getDate()).padStart(2, "0"),
  ].join("-")
  const activeOrders = orders.filter((order) => order.status !== "Entregado")
  const garments = orders.flatMap((order) => order.items)
  const garmentsInProduction = garments.filter((item) => {
    const phase = getGarmentPhase(item)
    return phase > 0 && phase < garmentProductionPhases.length
  }).length
  const dueOrders = activeOrders.filter((order) => order.dueDate <= dueSoonString)
  const productionStages = [
    { id: 0, name: "Sin iniciar" },
    ...garmentProductionPhases,
  ].map((phase) => ({
    ...phase,
    count: garments.filter((item) => getGarmentPhase(item) === phase.id).length,
  }))
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesSearch = `${order.id} ${order.customer} ${order.item}`
          .toLowerCase()
          .includes(search.toLowerCase())
        return matchesSearch && (statusFilter === "Todos" || order.status === statusFilter)
      }),
    [orders, search, statusFilter],
  )
  const formatDeliveryDate = (value: string) =>
    new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" })
      .format(new Date(`${value}T00:00:00`))

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 68)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar
        companyId={companyId}
        companyName={companyName}
        companies={companies}
        role={role}
        user={{ name: displayName, email, avatarUrl }}
      />
      <SidebarInset>
        <SiteHeader companyName={companyName} role={role} />
        <main
          className="@container/main flex min-w-0 flex-1 flex-col gap-5 p-4 md:gap-6 md:p-6"
          id="inicio"
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {appRoleLabels[role]}{companyName ? ` · ${companyName}` : " · Todas las empresas"}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Buenos días, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Esto es lo que está pasando en tu operación hoy.
            </p>
          </div>

          {ordersError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              No se pudieron cargar los pedidos y la producción: {ordersError}
            </p>
          )}
          {inventoryError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              No se pudo calcular el stock bajo: {inventoryError}
            </p>
          )}

          <section
            aria-label="Indicadores principales"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pedidos activos</CardDescription>
                <CardTitle className="text-3xl">{ordersLoading ? "—" : activeOrders.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Pedidos registrados que aún no se han entregado</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Prendas en producción</CardDescription>
                <CardTitle className="text-3xl">{ordersLoading ? "—" : garmentsInProduction}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Prendas en una fase activa de fabricación</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Entregas vencidas o próximas</CardDescription>
                <CardTitle className="text-3xl">{ordersLoading ? "—" : dueOrders.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Pedidos pendientes hasta los próximos 3 días</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Variantes con stock bajo</CardDescription>
                <CardTitle className="text-3xl">{inventory ? lowStock.length : "—"}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Disponibles iguales o inferiores al mínimo</CardContent>
            </Card>
          </section>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
            <section className="scroll-mt-6 min-w-0" id="pedidos">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>Pedidos recientes</CardTitle>
                      <CardDescription>
                        Seguimiento de los últimos pedidos registrados
                      </CardDescription>
                    </div>
                    <a className="text-sm font-medium text-primary" href="#pedidos">
                      Ver todos →
                    </a>
                  </div>
                  <div className="flex flex-col gap-2 pt-3 sm:flex-row">
                    <div className="relative flex-1">
                      <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        aria-label="Buscar pedidos"
                        className="pl-9"
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar pedido o cliente"
                        value={search}
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}>
                      <SelectTrigger aria-label="Filtrar pedidos por estado" className="w-full sm:w-44">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Todos">Todos</SelectItem>
                        {availableStatuses.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="min-w-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pedido / Cliente</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Entrega</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!ordersLoading && filteredOrders.slice(0, 5).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="font-medium">{order.customer}</div>
                            <div className="text-xs text-muted-foreground">{order.id}</div>
                          </TableCell>
                          <TableCell>{order.item} · {order.quantity} und.</TableCell>
                          <TableCell>{formatDeliveryDate(order.dueDate)}</TableCell>
                          <TableCell>
                            <Badge variant={order.status === "Entregado" ? "default" : "outline"}>
                              {order.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {ordersLoading && (
                        <TableRow>
                          <TableCell className="h-24 text-center text-muted-foreground" colSpan={4}>
                            Cargando pedidos…
                          </TableCell>
                        </TableRow>
                      )}
                      {!ordersLoading && filteredOrders.length === 0 && (
                        <TableRow>
                          <TableCell className="h-24 text-center text-muted-foreground" colSpan={4}>
                            No hay pedidos que coincidan con la búsqueda.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </section>

            <section className="scroll-mt-6" id="produccion">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Producción por etapa</CardTitle>
                  <CardDescription>Prendas registradas según su fase actual</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {ordersLoading ? (
                    <p className="text-sm text-muted-foreground">Cargando producción…</p>
                  ) : garments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay prendas registradas para producción.</p>
                  ) : productionStages.map((stage) => {
                    const progress = Math.round(stage.count / garments.length * 100)
                    return (
                      <div key={stage.id} className="space-y-2">
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="font-medium">{stage.name}</span>
                          <span className="shrink-0 text-muted-foreground">{stage.count} prendas</span>
                        </div>
                        <div
                          aria-label={`${stage.name}: ${progress}%`}
                          className="h-2 overflow-hidden rounded-full bg-muted"
                          role="meter"
                          aria-valuenow={progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </section>

            <section className="scroll-mt-6" id="inventario">
              <InventorySummary
                inventory={inventory}
                inventoryError={inventoryError}
              />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
