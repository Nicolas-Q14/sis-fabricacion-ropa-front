"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
import { saveSupabaseInventoryMovement } from "@/lib/inventory/use-demo-inventory"
import type { InventoryProduct, InventoryVariant } from "@/lib/inventory/demo-inventory"

const stockAdjustmentSchema = z.object({
  type: z.enum(["Entrada", "Salida"]),
  quantity: z.string().regex(/^[1-9]\d*$/, "Ingresa una cantidad entera mayor que cero.")
    .transform(Number),
  warehouse: z.string().min(1, "Selecciona una bodega."),
  reason: z.string().trim().max(250, "La razón no puede superar 250 caracteres."),
})

type StockAdjustmentInput = z.input<typeof stockAdjustmentSchema>
type StockAdjustmentValues = z.output<typeof stockAdjustmentSchema>

export function InventoryStockAdjustment({
  companyId,
  product,
  variant,
  warehouses,
  preferredWarehouse,
  onClose,
  onSaved,
}: {
  companyId: string
  product: InventoryProduct | null
  variant: InventoryVariant | null
  warehouses: { id: string; name: string }[]
  preferredWarehouse?: string
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const form = useForm<StockAdjustmentInput, unknown, StockAdjustmentValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      type: "Entrada",
      quantity: "",
      warehouse: preferredWarehouse ?? warehouses[0]?.name ?? "",
      reason: "",
    },
  })
  const saving = form.formState.isSubmitting

  async function submit(values: StockAdjustmentValues) {
    if (!variant) return
    try {
      await saveSupabaseInventoryMovement(companyId, {
        type: values.type,
        variantId: variant.id,
        quantity: values.quantity,
        warehouse: values.warehouse,
        reference: "Frenesi sport",
        note: values.reason,
      })
      await onSaved()
      toast.success(values.type === "Entrada"
        ? "Entrada de stock registrada."
        : "Salida de stock registrada.")
      onClose()
    } catch (caught) {
      toast.error(caught instanceof Error
        ? caught.message
        : "No se pudo registrar el movimiento.")
    }
  }

  return (
    <Dialog open={Boolean(variant)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar existencias</DialogTitle>
          <DialogDescription>
            {product && variant
              ? `${product.name} · ${variant.color} · ${variant.size}. Las salidas no pueden reducir el stock reservado.`
              : "Registra una entrada o salida manual de stock."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
          <label className="grid gap-1.5 text-sm font-medium">
            Movimiento
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" {...form.register("type")}>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Bodega
            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" {...form.register("warehouse")}>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.name}>{warehouse.name}</option>
              ))}
            </select>
            {form.formState.errors.warehouse && (
              <span className="text-xs text-destructive">{form.formState.errors.warehouse.message}</span>
            )}
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Cantidad
            <Input min="1" step="1" type="number" {...form.register("quantity")} />
            {form.formState.errors.quantity && (
              <span className="text-xs text-destructive">{form.formState.errors.quantity.message}</span>
            )}
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Razón (opcional)
            <Input maxLength={250} placeholder="Compra de insumos, ajuste de inventario…" {...form.register("reason")} />
            {form.formState.errors.reason && (
              <span className="text-xs text-destructive">{form.formState.errors.reason.message}</span>
            )}
          </label>
          <DialogFooter>
            <Button disabled={saving} onClick={onClose} type="button" variant="outline">
              Cancelar
            </Button>
            <Button disabled={saving || warehouses.length === 0} type="submit">
              {saving ? "Registrando…" : "Registrar movimiento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
