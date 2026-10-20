import { OrderWizard } from "@/components/orders/order-wizard"
import { createAdminClient } from "@/lib/supabase/admin"

export default async function NewOrderPage() {
  const admin = createAdminClient()
  const { data: roleRows, error: rolesError } = await admin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "gerente_produccion"])

  if (rolesError) {
    throw new Error("No se pudieron cargar los perfiles de vendedores.")
  }

  const { data: profileRows, error: profilesError } = await admin
    .from("user_profiles")
    .select("user_id")

  if (profilesError) {
    throw new Error("No se pudieron cargar los perfiles de vendedores.")
  }

  const profileUserIds = new Set((profileRows ?? []).map((profile) => profile.user_id))
  const managedUserIds = [...new Set(
    (roleRows ?? [])
      .map((row) => row.user_id)
      .filter((userId) => profileUserIds.has(userId)),
  )]
  const managedUserIdSet = new Set(managedUserIds)
  const authUsers = []

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) {
      throw new Error("No se pudieron cargar los nombres de los perfiles de vendedores.")
    }

    authUsers.push(...data.users)
    if (data.users.length < 100) break
  }

  const salespersonNames = [...new Set(authUsers.flatMap((user) => {
    if (!managedUserIdSet.has(user.id) || user.app_metadata?.is_active === false) return []
    const name = user.user_metadata?.full_name
    return typeof name === "string" && name.trim() ? [name.trim()] : []
  }))].sort((a, b) => a.localeCompare(b, "es"))

  return <OrderWizard salespersonNames={salespersonNames} />
}
