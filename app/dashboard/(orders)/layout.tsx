import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { OrdersDashboardShell } from "@/components/orders-dashboard-shell"
import { isAppRole, type AppRole } from "@/lib/auth/roles"
import { SINGLE_COMPANY_ID } from "@/lib/supabase/single-company"
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
    .select("role")
    .eq("user_id", user.id)
  if (rolesError) throw new Error("No se pudieron consultar los permisos de pedidos.")

  const roles = (roleRows ?? []).filter(
    (row): row is typeof row & { role: AppRole } => isAppRole(row.role),
  )
  if (roles.length === 0) redirect("/dashboard")

  const companyId = SINGLE_COMPANY_ID
  const companyName = "Sede única"
  const role: AppRole | null = roles.some((row) => row.role === "superadmin")
    ? "superadmin"
    : roles.some((row) => row.role === "admin")
      ? "admin"
      : roles.some((row) => row.role === "gerente_produccion")
        ? "gerente_produccion"
        : null
  if (!role || !isAppRole(role)) redirect("/dashboard")

  return (
    <OrdersDashboardShell
      avatarUrl={typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null}
      companyId={companyId}
      companyName={companyName}
      companies={[]}
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
