"use client"

import { useParams } from "next/navigation"
import { InventoryProductEditor } from "@/components/inventory/inventory-product-editor"

export default function EditInventoryProductPage() {
  const { productId } = useParams<{ productId: string }>()
  return <InventoryProductEditor productId={productId} />
}
