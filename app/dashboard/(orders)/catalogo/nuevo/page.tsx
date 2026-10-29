import { InventoryProductEditor } from "@/components/inventory/inventory-product-editor"
import { requireSuperadmin } from "@/lib/auth/require-superadmin"

export default async function NewCatalogProductPage() {
  await requireSuperadmin()
  return <InventoryProductEditor returnTo="/dashboard/catalogo" />
}
