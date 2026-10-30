import { CatalogManager } from "@/components/inventory/catalog-manager"
import { PublicCatalogMarketingAdmin } from "@/components/inventory/public-catalog-marketing-admin"
import { requireSuperadmin } from "@/lib/auth/require-superadmin"

export default async function CatalogManagementPage() {
  await requireSuperadmin()
  return (
    <div className="space-y-6">
      <CatalogManager />
      <PublicCatalogMarketingAdmin />
    </div>
  )
}
