"use client"

import { useMemo, useState } from "react"
import type { CSSProperties } from "react"
import data from "@/app/dashboard/data.json"
import { AppSidebar } from "@/components/app-sidebar"
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

const metrics = [
  { label: "Pedidos activos", value: "24", detail: "12% vs. mes anterior" },
  { label: "En producción", value: "18", detail: "6 para hoy · en 4 etapas" },
  { label: "Por entregar", value: "7", detail: "2 urgentes · próximos 3 días" },
  { label: "Insumos por agotarse", value: "3", detail: "Revisar inventario" },
]

const productionStages = [
  { name: "Corte", count: "12 órdenes", progress: 76 },
  { name: "Sublimación", count: "8 órdenes", progress: 58 },
  { name: "Confección", count: "15 órdenes", progress: 84 },
  { name: "Terminados", count: "6 órdenes", progress: 42 },
]

const lowSupplies = [
  { name: "Tela deportiva dry fit", available: "12 metros disponibles", quantity: "12 m", progress: 18 },
  { name: "Hilo poliéster blanco", available: "8 conos disponibles", quantity: "8 u", progress: 28 },
  { name: "Papel para sublimación", available: "2 rollos disponibles", quantity: "2 r", progress: 12 },
]

const recentActivity = [
  { title: "Pedido FS-2084 pasó a confección", detail: "Andrés P. · hace 18 min" },
  { title: "Nuevo pedido registrado", detail: "María G. · hace 42 min" },
  { title: "Salida de tela dry fit · 8 m", detail: "Laura R. · hace 1 h" },
]

export function DashboardClient({
  companies,
  companyId,
  companyName,
  email,
  fullName,
  avatarUrl,
  role,
}: {
  companies: CompanyOption[]
  companyId: string | null
  companyName: string | null
  email: string
  fullName: string
  avatarUrl: string | null
  role: AppRole
}) {
  const displayName = fullName.trim() || email || "Tu cuenta"
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("Todos")
  const filteredOrders = useMemo(
    () =>
      data.filter((order) => {
        const matchesSearch = `${order.id} ${order.customer} ${order.item}`
          .toLowerCase()
          .includes(search.toLowerCase())
        return matchesSearch && (statusFilter === "Todos" || order.status === statusFilter)
      }),
    [search, statusFilter],
  )

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

          <div
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            role="note"
          >
            Vista de demostración: los indicadores, pedidos, etapas y materiales
            son ejemplos y aún no están conectados a tablas de Supabase.
          </div>

          <section
            aria-label="Indicadores principales"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {metrics.map((metric) => (
              <Card key={metric.label}>
                <CardHeader className="pb-2">
                  <CardDescription>{metric.label}</CardDescription>
                  <CardTitle className="text-3xl">{metric.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {metric.detail}
                </CardContent>
              </Card>
            ))}
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
                        <SelectItem value="En producción">En producción</SelectItem>
                        <SelectItem value="Pendiente">Pendiente</SelectItem>
                        <SelectItem value="Listo">Listo</SelectItem>
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
                      {filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="font-medium">{order.customer}</div>
                            <div className="text-xs text-muted-foreground">{order.id}</div>
                          </TableCell>
                          <TableCell>{order.item}</TableCell>
                          <TableCell>{order.due}</TableCell>
                          <TableCell>
                            <Badge variant={order.status === "Listo" ? "default" : "outline"}>
                              {order.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredOrders.length === 0 && (
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
                  <CardTitle>Producción de hoy</CardTitle>
                  <CardDescription>Órdenes activas por etapa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {productionStages.map((stage) => (
                    <div key={stage.name} className="space-y-2">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-medium">{stage.name}</span>
                        <span className="text-muted-foreground">{stage.count}</span>
                      </div>
                      <div
                        aria-label={`${stage.name}: ${stage.progress}%`}
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        role="meter"
                        aria-valuenow={stage.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${stage.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            <section className="scroll-mt-6" id="inventario">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Insumos por agotarse</CardTitle>
                  <CardDescription>Materiales que requieren atención · 3 alertas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {lowSupplies.map((supply) => (
                    <div key={supply.name} className="space-y-2">
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-medium">{supply.name}</span>
                        <span className="shrink-0">{supply.quantity}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex-1 text-xs text-muted-foreground">{supply.available}</span>
                        <div
                          aria-label={`Nivel disponible: ${supply.progress}%`}
                          className="h-2 w-20 overflow-hidden rounded-full bg-muted"
                          role="meter"
                          aria-valuenow={supply.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full rounded-full bg-amber-500"
                            style={{ width: `${supply.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>

            {role !== "gerente_produccion" && (
              <section className="scroll-mt-6" id="actividad">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Actividad reciente</CardTitle>
                    <CardDescription>Últimos movimientos del equipo</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {recentActivity.map((activity) => (
                      <div key={activity.title} className="flex gap-3">
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">{activity.detail}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
