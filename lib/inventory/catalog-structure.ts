import type { InventoryProduct } from "@/lib/inventory/demo-inventory"

export const INVENTORY_FAMILIES = {
  Textiles: [
    { value: "busos_capota", label: "Busos con capota", code: "BSC" },
    { value: "camibusos", label: "Camibusos", code: "CMB" },
    { value: "camisetas", label: "Camisetas", code: "CAM" },
    { value: "camisetas_manga_larga", label: "Camisetas manga larga", code: "CML" },
    { value: "chaquetas", label: "Chaquetas", code: "CHA" },
    { value: "petos", label: "Petos", code: "PET" },
    { value: "polo", label: "Polo", code: "POL" },
    { value: "sudaderas", label: "Sudaderas", code: "SUD" },
    { value: "pantalonetas", label: "Pantalonetas", code: "PAN" },
    { value: "medias", label: "Medias", code: "MED" },
    { value: "otros", label: "Otros textiles", code: "OTR" },
  ],
  Promocionales: [
    { value: "mugs_y_termos", label: "Mugs y termos", code: "MUG" },
    { value: "toallas_microfibra", label: "Toallas microfibra", code: "TMI" },
    { value: "otros", label: "Otros promocionales", code: "OTR" },
  ],
} as const

export type InventoryFamily = keyof typeof INVENTORY_FAMILIES

export const DEFAULT_CATALOG_YEAR = 2026

export function getSubcategoryLabel(family: string, subcategory: string) {
  const options = family === "all"
    ? Object.values(INVENTORY_FAMILIES).flat()
    : INVENTORY_FAMILIES[family as InventoryFamily]
  return options?.find((option) => option.value === subcategory)?.label ?? subcategory
}

export function createInventorySku(
  year: number,
  family: InventoryFamily,
  subcategory: string,
  products: InventoryProduct[],
  excludeProductId?: string,
) {
  const familyCode = family === "Textiles" ? "TEX" : "PRO"
  const subcategoryCode = INVENTORY_FAMILIES[family]
    .find((option) => option.value === subcategory)?.code ?? "OTR"
  const prefix = `FS-${year}-${familyCode}-${subcategoryCode}`
  const existingSkus = new Set(
    products
      .filter((product) => product.id !== excludeProductId)
      .map((product) => product.sku.toUpperCase()),
  )

  let sequence = 1
  let sku = ""
  do {
    sku = `${prefix}-${String(sequence).padStart(3, "0")}`
    sequence += 1
  } while (existingSkus.has(sku))

  return sku
}
