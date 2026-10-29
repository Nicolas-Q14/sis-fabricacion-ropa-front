import { CatalogManager } from "@/components/inventory/catalog-manager"
import { requireSuperadmin } from "@/lib/auth/require-superadmin"

export default async function CatalogManagementPage() {
  await requireSuperadmin()
  return <CatalogManager />
}
