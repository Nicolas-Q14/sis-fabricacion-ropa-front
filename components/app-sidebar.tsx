"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { appRoleLabels, type AppRole, type CompanyOption } from "@/lib/auth/roles"
import { FactoryIcon, FileTextIcon, ShirtIcon, UsersRoundIcon, BookOpenIcon } from "lucide-react"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  companyId: string | null
  companyName: string | null
  companies: CompanyOption[]
  role: AppRole
  user: { name: string; email: string; avatarUrl?: string | null }
}

export function AppSidebar({
  companyId,
  companyName,
  companies,
  role,
  user,
  ...props
}: AppSidebarProps) {
  const router = useRouter()
  const items = [
    { title: "Resumen", url: "/dashboard", icon: <FactoryIcon /> },
    { title: "Pedidos", url: "/dashboard/orders", icon: <ShirtIcon /> },
    { title: "Cotizaciones", url: "/dashboard/quotations", icon: <FileTextIcon /> },
    { title: "Producción", url: "/dashboard/production", icon: <FactoryIcon /> },
    { title: "Inventario", url: "/dashboard/inventory", icon: <ShirtIcon /> },
    ...(role === "superadmin"
      ? [
          { title: "Gestión de usuarios", url: "/dashboard/usuarios", icon: <UsersRoundIcon /> },
          { title: "Catálogo público", url: "/dashboard/catalogo", icon: <BookOpenIcon /> },
        ]
      : []),
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<a href="/dashboard" />}
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ShirtIcon className="size-5" />
              </span>
              <span className="text-base font-semibold">Frenesi Sport</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {companies.length > 1 ? (
          <div className="px-2 pt-2">
            <label
              className="mb-1 block text-xs font-medium text-muted-foreground"
              htmlFor="active-company"
            >
              Empresa activa
            </label>
            <select
              className="h-9 w-full rounded-md border border-sidebar-border bg-sidebar px-2 text-sm"
              id="active-company"
              value={companyId ?? ""}
              onChange={(event) => {
                router.push(
                  `/dashboard?companyId=${encodeURIComponent(event.target.value)}`,
                )
              }}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="px-3 pt-2">
            <p className="truncate text-sm font-medium">
              {companyName ?? "Todas las empresas"}
            </p>
            <p className="text-xs text-muted-foreground">{appRoleLabels[role]}</p>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <NavMain items={items} />
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} role={role} />
      </SidebarFooter>
    </Sidebar>
  )
}
