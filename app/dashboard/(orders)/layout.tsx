import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { OrdersDashboardShell } from "@/components/orders-dashboard-shell"
import { isAppRole, type AppRole } from "@/lib/auth/roles"
import { createClient } from "@/lib/supabase/server"

export default async function OrdersLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) redirect("/login")
  if (user.app_metadata?.is_active === false) redirect("/account-disabled")
  if (user.app_metadata?.must_change_password === true) {
    redirect("/dashboard/change-password")
  }

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("role, company_id")
    .eq("user_id", user.id)
  if (rolesError) throw new Error("No se pudieron consultar los permisos de pedidos.")

  const roles = (roleRows ?? []).filter(
    (row): row is typeof row & { role: AppRole } => isAppRole(row.role),
  )
  if (roles.length === 0) redirect("/dashboard")

  const isGlobal = roles.some(
    (row) => row.role === "superadmin" || (row.role === "admin" && row.company_id === null),
  )
  const companyIds = [...new Set(
    roles.map((row) => row.company_id).filter((id): id is string => Boolean(id)),
  )]
  const companiesQuery = supabase.from("companies").select("id, name").order("name")
  const { data: companyRows, error: companiesError } = isGlobal
    ? await companiesQuery
    : companyIds.length > 0
      ? await companiesQuery.in("id", companyIds)
      : { data: [], error: null }
  if (companiesError) throw new Error("No se pudieron cargar las empresas disponibles.")

  const companies = companyRows ?? []
  const companyId = companies[0]?.id ?? null
  const companyName = companies[0]?.name ?? null
  const role = roles.some((row) => row.role === "superadmin")
    ? "superadmin"
    : roles.some((row) => row.role === "admin" && row.company_id === companyId)
      ? "admin"
      : roles.find((row) => row.company_id === companyId)?.role
        ?? roles.find((row) => row.company_id === null)?.role
        ?? null
  if (!role || !isAppRole(role)) redirect("/dashboard")

  return (
    <OrdersDashboardShell
      avatarUrl={typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null}
      companyId={companyId}
      companyName={companyName}
      companies={companies}
      email={user.email ?? ""}
      fullName={typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : ""}
      operatorId={user.id}
      role={role}
    >
      {children}
    </OrdersDashboardShell>
  )
}
