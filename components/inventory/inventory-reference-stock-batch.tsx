"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { saveSupabaseInventoryStockBatch } from "@/lib/inventory/use-demo-inventory"
import type { InventoryProduct } from "@/lib/inventory/demo-inventory"

export function InventoryReferenceStockBatch({
  companyId,
  product,
  warehouses,
  defaultWarehouse,
  onClose,
  onSaved,
}: {
  companyId: string
  product: InventoryProduct | null
  warehouses: { id: string; name: string }[]
  defaultWarehouse?: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [type, setType] = useState<"Entrada" | "Salida">("Entrada")
  const [warehouse, setWarehouse] = useState(
    warehouses.find((item) => item.name === defaultWarehouse)?.name
    ?? warehouses[0]?.name
    ?? "",
  )
  const [reason, setReason] = useState("")
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [newVariants, setNewVariants] = useState<{ color: string; size: string; quantity: string }[]>([])
  const [saving, setSaving] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!product) return

    const items: (
      | { variantId: string; quantity: number }
      | { color: string; size: string; quantity: number }
    )[] = product.variants.flatMap((variant) => {
      const rawQuantity = quantities[variant.id]?.trim() ?? ""
      if (!rawQuantity || rawQuantity === "0") return []
      if (!/^[1-9]\d*$/.test(rawQuantity) || !Number.isSafeInteger(Number(rawQuantity))) {
        return [{ variantId: variant.id, quantity: Number.NaN }]
      }
      return [{ variantId: variant.id, quantity: Number(rawQuantity) }]
    })
    const enteredNewVariants = newVariants.filter((variant) =>
      variant.color.trim() || variant.size.trim() || variant.quantity.trim(),
    )
    if (type === "Salida" && enteredNewVariants.length) {
      toast.error("Las tallas nuevas solo se pueden crear registrando una entrada.")
      return
    }
    if (enteredNewVariants.some((variant) =>
      !variant.color.trim()
      || !variant.size.trim()
      || !/^[1-9]\d*$/.test(variant.quantity.trim())
      || !Number.isSafeInteger(Number(variant.quantity))
      || Number(variant.quantity) > 2147483647,
    )) {
      toast.error("Completa color, talla y una cantidad entera mayor que cero para cada nueva variante.")
      return
    }
    const normalizedNewVariants = enteredNewVariants.map((variant) => ({
      color: variant.color.trim(),
      size: variant.size.trim(),
      quantity: Number(variant.quantity),
    }))
    const existingVariantKeys = new Set(product.variants.map((variant) =>
      `${variant.color.trim().toLocaleLowerCase()}|${variant.size.trim().toLocaleLowerCase()}`,
    ))
    const newVariantKeys = normalizedNewVariants.map((variant) =>
      `${variant.color.toLocaleLowerCase()}|${variant.size.toLocaleLowerCase()}`,
    )
    if (newVariantKeys.some((key) => existingVariantKeys.has(key))
      || new Set(newVariantKeys).size !== newVariantKeys.length) {
      toast.error("Ya existe una de las combinaciones de color y talla ingresadas. Ajusta la variante existente.")
      return
    }
    items.push(...normalizedNewVariants)
    if (!items.length) {
      toast.error("Ingresa una cantidad mayor que cero para al menos una talla y color.")
      return
    }
    if (items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
      toast.error("Todas las cantidades deben ser números enteros mayores que cero.")
      return
    }
    if (!warehouse) {
      toast.error("Selecciona una bodega.")
      return
    }

    setSaving(true)
    try {
      await saveSupabaseInventoryStockBatch(companyId, {
        productId: product.id,
        type,
        warehouse,
        note: reason,
        items,
      })
      await onSaved()
      toast.success(`Se registró ${type.toLocaleLowerCase()} para ${items.length} variantes de ${product.sku}.`)
      onClose()
    } catch (caught) {
      toast.error(caught instanceof Error
        ? caught.message
        : "No se pudo registrar el lote de existencias.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar unidades por talla y color</DialogTitle>
          <DialogDescription>
            {product
              ? `${product.name} · referencia ${product.sku}. Ingresa una cantidad solo en las variantes que quieras modificar.`
              : "Registra unidades para una o más variantes de la referencia."}
          </DialogDescription>
        </DialogHeader>
        {product && (
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-sm font-medium">
                Movimiento
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => setType(event.target.value === "Salida" ? "Salida" : "Entrada")}
                  value={type}
                >
                  <option value="Entrada">Entrada</option>
                  <option value="Salida">Salida</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Bodega
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => setWarehouse(event.target.value)}
                  value={warehouse}
                >
                  {warehouses.map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Razón (opcional)
                <Input
                  maxLength={250}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Compra, ajuste, devolución…"
                  value={reason}
                />
              </label>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2 font-medium">Color</th>
                    <th className="p-2 font-medium">Talla</th>
                    <th className="p-2 font-medium">Stock actual</th>
                    <th className="p-2 font-medium">Unidades {type.toLowerCase()}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...product.variants]
                    .sort((left, right) =>
                      left.color.localeCompare(right.color, "es")
                      || left.size.localeCompare(right.size, "es", { numeric: true }))
                    .map((variant) => (
                      <tr className="border-t" key={variant.id}>
                        <td className="p-2">{variant.color}</td>
                        <td className="p-2">{variant.size}</td>
                        <td className="p-2">{variant.stockByWarehouse[warehouse] ?? 0}</td>
                        <td className="w-40 p-2">
                          <Input
                            aria-label={`${type} de unidades para ${variant.color} talla ${variant.size}`}
                            min="0"
                            onChange={(event) => setQuantities((current) => ({
                              ...current,
                              [variant.id]: event.target.value,
                            }))}
                            step="1"
                            type="number"
                            value={quantities[variant.id] ?? ""}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <section className="grid gap-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">Agregar talla o color nuevo</h3>
                  <p className="text-xs text-muted-foreground">
                    Crea una variante que todavía no exista y registra su stock inicial.
                  </p>
                </div>
                <Button
                  disabled={type === "Salida"}
                  onClick={() => setNewVariants((current) => [
                    ...current,
                    { color: "", size: "", quantity: "" },
                  ])}
                  type="button"
                  variant="outline"
                >
                  <PlusIcon data-icon="inline-start" /> Añadir variante
                </Button>
              </div>
              {type === "Salida" && (
                <p className="text-xs text-muted-foreground">
                  Cambia el movimiento a Entrada para crear tallas nuevas.
                </p>
              )}
              {newVariants.map((variant, index) => (
                <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" key={`new-variant-${index}`}>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Color
                    <Input
                      disabled={type === "Salida"}
                      maxLength={80}
                      onChange={(event) => setNewVariants((current) => current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, color: event.target.value } : item,
                      ))}
                      placeholder="Ej. Azul marino"
                      value={variant.color}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Talla
                    <Input
                      disabled={type === "Salida"}
                      maxLength={40}
                      onChange={(event) => setNewVariants((current) => current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, size: event.target.value } : item,
                      ))}
                      placeholder="Ej. XXL"
                      value={variant.size}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Unidades de entrada
                    <Input
                      disabled={type === "Salida"}
                      min="1"
                      onChange={(event) => setNewVariants((current) => current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, quantity: event.target.value } : item,
                      ))}
                      step="1"
                      type="number"
                      value={variant.quantity}
                    />
                  </label>
                  <Button
                    aria-label={`Quitar nueva variante ${index + 1}`}
                    onClick={() => setNewVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
            </section>

            {type === "Salida" && (
              <p className="text-xs text-muted-foreground">
                Cada salida se valida contra las reservas activas; si alguna cantidad excede el disponible, no se aplicará ningún cambio del lote.
              </p>
            )}
            <DialogFooter>
              <Button disabled={saving} onClick={onClose} type="button" variant="outline">
                Cancelar
              </Button>
              <Button disabled={saving || !warehouses.length} type="submit">
                {saving ? "Guardando lote…" : `Registrar ${type.toLowerCase()}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
