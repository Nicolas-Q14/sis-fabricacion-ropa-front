import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function requireSuperadmin() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) redirect("/login")
  if (user.app_metadata?.is_active === false) redirect("/account-disabled")
  if (user.app_metadata?.must_change_password === true) {
    redirect("/dashboard/change-password")
  }

  const { data: role, error: roleError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "superadmin")
    .is("company_id", null)
    .maybeSingle()

  if (roleError) {
    throw new Error("No se pudieron verificar los permisos de superadministrador.")
  }
  if (!role) redirect("/dashboard")

  return user
}
