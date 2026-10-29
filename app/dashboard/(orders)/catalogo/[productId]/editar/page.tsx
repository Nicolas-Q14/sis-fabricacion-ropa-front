import { InventoryProductEditor } from "@/components/inventory/inventory-product-editor"
import { requireSuperadmin } from "@/lib/auth/require-superadmin"

export default async function EditCatalogProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  await requireSuperadmin()
  const { productId } = await params
  return <InventoryProductEditor productId={productId} returnTo="/dashboard/catalogo" />
}
