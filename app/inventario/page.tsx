import type { Metadata } from "next"
import { PublicInventory } from "@/components/public-inventory"

export const metadata: Metadata = {
  title: "Inventario actual | Frenesi Sport",
  description: "Consulta las prendas y tallas disponibles en Frenesi Sport.",
}

export default function InventoryPage() {
  return <PublicInventory />
}
