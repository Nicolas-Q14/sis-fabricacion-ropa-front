"use client"

import type { CSSProperties, ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { OrdersOperatorProvider } from "@/components/orders/orders-operator-context"
import type { AppRole, CompanyOption } from "@/lib/auth/roles"

export function OrdersDashboardShell({
  children,
  avatarUrl,
  companyId,
  companyName,
  companies,
  email,
  fullName,
  operatorId,
  role,
}: {
  children: ReactNode
  avatarUrl: string | null
  companyId: string
  companyName: string | null
  companies: CompanyOption[]
  email: string
  fullName: string
  operatorId: string
  role: AppRole
}) {
  const displayName = fullName.trim() || email || "Tu cuenta"

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
        <OrdersOperatorProvider companyId={companyId} operator={{ userId: operatorId, name: displayName }}>
          <main className="@container/main flex min-w-0 flex-1 flex-col gap-5 p-4 md:gap-6 md:p-6">
            {children}
          </main>
        </OrdersOperatorProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
