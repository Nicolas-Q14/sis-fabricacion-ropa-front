import {
  garmentProductionPhases,
  getOrderStatus,
  type DemoOrder,
  type GarmentPhaseReached,
  type OrderGarment,
} from "@/lib/orders/demo-data"
import { createClient } from "@/lib/supabase/client"

type OrderRow = {
  id: string
  company_id: string
  code: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  seller_name: string | null
  entry_date: string
  delivery_date: string
  status: string
  total_amount: number
  total_paid: number
  note: string | null
  summary: string | null
  deleted_at: string | null
  archived_at: string | null
  created_at: string
}

type OrderItemRow = {
  id: string
  order_id: string
  inventory_variant_id: string | null
  inventory_warehouse_id: string | null
  garment_type: string
  fit: string
  color: string
  size: string
  printed_name: string | null
  printed_number: string | null
  notes: string | null
  unit_price: number
  price_manually_edited: boolean
  adjustments: NonNullable<OrderGarment["adjustment"]>[]
  current_phase: number
  phase_operator_name: string | null
}

type ProductionEventRow = {
  id: string
  order_id: string
  order_item_id: string
  phase_id: number
  event_type: string
  user_id: string | null
  operator_name: string
  created_at: string
  observation: string | null
}

type OrderEventRow = {
  id: string
  order_id: string
  event_type: string
  description: string
  user_id: string | null
  operator_name: string
  created_at: string
}

type PaymentRow = {
  order_id: string
  payment_method: string
  created_at: string
}

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function orderStatus(value: string) {
  return garmentProductionPhases.some((phase) => phase.name === value)
    ? value as DemoOrder["status"]
    : garmentProductionPhases[0].name
}

export async function loadSupabaseOrders(companyId: string) {
  const supabase = createClient()
  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, company_id, code, customer_name, customer_phone, customer_email, seller_name, entry_date, delivery_date, status, total_amount, total_paid, note, summary, deleted_at, archived_at, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
  throwOnError(orderError)

  const rows = (orderData ?? []) as OrderRow[]
  if (!rows.length) return { orders: [], trashedOrders: [] }
  const orderIds = rows.map((order) => order.id)
  const [
    { data: itemData, error: itemError },
    { data: productionData, error: productionError },
    { data: eventData, error: eventError },
    { data: paymentData, error: paymentError },
  ] = await Promise.all([
    supabase.from("order_items").select("*").eq("company_id", companyId).in("order_id", orderIds),
    supabase.from("production_events").select("*").eq("company_id", companyId).in("order_id", orderIds).order("created_at"),
    supabase.from("order_events").select("*").eq("company_id", companyId).in("order_id", orderIds).order("created_at", { ascending: false }),
    supabase.from("order_payments").select("order_id, payment_method, created_at").eq("company_id", companyId).in("order_id", orderIds).order("created_at", { ascending: false }),
  ])
  throwOnError(itemError)
  throwOnError(productionError)
  throwOnError(eventError)
  throwOnError(paymentError)

  const itemsByOrder = new Map<string, OrderItemRow[]>()
  for (const item of (itemData ?? []) as OrderItemRow[]) {
    itemsByOrder.set(item.order_id, [...(itemsByOrder.get(item.order_id) ?? []), item])
  }
  const productionsByItem = new Map<string, ProductionEventRow[]>()
  for (const event of (productionData ?? []) as ProductionEventRow[]) {
    productionsByItem.set(event.order_item_id, [
      ...(productionsByItem.get(event.order_item_id) ?? []),
      event,
    ])
  }
  const eventsByOrder = new Map<string, OrderEventRow[]>()
  for (const event of (eventData ?? []) as OrderEventRow[]) {
    eventsByOrder.set(event.order_id, [...(eventsByOrder.get(event.order_id) ?? []), event])
  }
  const latestPaymentMethod = new Map<string, string>()
  for (const payment of (paymentData ?? []) as PaymentRow[]) {
    if (!latestPaymentMethod.has(payment.order_id)) {
      latestPaymentMethod.set(payment.order_id, payment.payment_method)
    }
  }

  const orders = rows.map((row): DemoOrder => {
    const items = (itemsByOrder.get(row.id) ?? []).map((item): OrderGarment => {
      const productionEvents = productionsByItem.get(item.id) ?? []
      const verifications = new Map<number, NonNullable<OrderGarment["production"]>["verifications"][number]>()
      for (const event of productionEvents) {
        if (event.event_type === "avance") {
          verifications.set(event.phase_id, {
            phase: event.phase_id as Exclude<GarmentPhaseReached, 0>,
            userId: event.user_id ?? "",
            operator: event.operator_name,
            verifiedAt: event.created_at,
          })
        }
      }
      return {
        id: item.id,
        inventoryVariantId: item.inventory_variant_id,
        inventoryWarehouseId: item.inventory_warehouse_id,
        garment: item.garment_type,
        fit: item.fit,
        color: item.color,
        size: item.size,
        name: item.printed_name ?? "",
        number: item.printed_number ?? "",
        notes: item.notes ?? "",
        unitPrice: Number(item.unit_price),
        priceManuallyEdited: item.price_manually_edited,
        adjustment: item.adjustments?.[0],
        netPrice: (() => {
          const adjustment = item.adjustments?.[0]
          if (!adjustment?.enabled) return Number(item.unit_price)
          const amount = adjustment.mode === "percent"
            ? Number(item.unit_price) * adjustment.value / 100
            : adjustment.value
          return Math.max(0, Number(item.unit_price)
            + (adjustment.type === "surcharge" ? amount : -amount))
        })(),
        production: {
          currentPhase: item.current_phase as GarmentPhaseReached,
          verifications: [...verifications.values()].sort((a, b) => a.phase - b.phase),
        },
      }
    })
    const timeline = [
      ...(eventsByOrder.get(row.id) ?? []).map((event) => ({
        date: displayDate(event.created_at),
        title: event.description,
        operator: event.operator_name,
        timestamp: event.created_at,
      })),
      ...items.flatMap((item) => (productionsByItem.get(item.id ?? "") ?? []).map((event) => ({
        date: displayDate(event.created_at),
        title: event.event_type === "retroceso"
          ? `Prenda retrocedida a ${garmentProductionPhases[event.phase_id - 1]?.name ?? "Sin iniciar"}`
          : `Prenda verificada en ${garmentProductionPhases[event.phase_id - 1]?.name ?? "Sin iniciar"}`,
        operator: event.operator_name,
        timestamp: event.created_at,
      }))),
    ].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

    const order: DemoOrder = {
      id: row.code,
      companyId: row.company_id,
      entryDate: row.entry_date,
      createdAt: row.created_at,
      deletedAt: row.deleted_at,
      archivedAt: row.archived_at,
      customer: row.customer_name,
      item: items[0]?.garment ?? row.summary ?? "Prenda personalizada",
      quantity: items.length,
      dueDate: row.delivery_date,
      status: orderStatus(row.status),
      stage: "diseno",
      progress: 0,
      total: Number(row.total_amount),
      paid: Number(row.total_paid),
      paymentMethod: latestPaymentMethod.get(row.id) ?? null,
      paymentStatus: Number(row.total_paid) <= 0
        ? "Pendiente"
        : Number(row.total_paid) >= Number(row.total_amount)
          ? "Pagado"
          : "Abonado",
      salesperson: row.seller_name ?? "",
      note: row.note ?? "",
      items,
      timeline: timeline.map(({ date, title, operator }) => ({ date, title, operator })),
    }
    order.status = getOrderStatus(order)
    return order
  })

  return {
    orders: orders.filter((order) => !order.deletedAt && !order.archivedAt),
    trashedOrders: orders.filter((order) => Boolean(order.deletedAt || order.archivedAt)),
  }
}

export async function createSupabaseOrder(
  companyId: string,
  order: Omit<DemoOrder, "companyId">,
  inventory: {
    products: { id: string; name: string; variants: { id: string; color: string; size: string }[] }[]
    warehouses?: { id: string; name: string }[]
  },
) {
  const warehouse = inventory.warehouses?.find((item) => item.name === "Bodega principal")
  if (!warehouse) {
    throw new Error("No existe la bodega principal. Configura el inventario antes de crear pedidos.")
  }
  const items = order.items.map((item) => {
    const product = inventory.products.find((candidate) => candidate.name === item.garment)
    const variant = product?.variants.find(
      (candidate) => candidate.color === item.color && candidate.size === item.size,
    )
    if (!variant) {
      throw new Error(`No existe la variante de inventario ${item.garment}, ${item.color}, talla ${item.size}.`)
    }
    return {
      inventory_variant_id: variant.id,
      inventory_warehouse_id: warehouse.id,
      garment_type: item.garment,
      fit: item.fit,
      color: item.color,
      size: item.size,
      printed_name: item.name,
      printed_number: item.number,
      notes: item.notes,
      unit_price: item.unitPrice ?? 0,
      price_manually_edited: item.priceManuallyEdited ?? false,
      adjustments: item.adjustment ? [item.adjustment] : [],
    }
  })
  const supabase = createClient()
  const { error } = await supabase.rpc("create_order_with_items", {
    p_company_id: companyId,
    p_order: {
      code: order.id,
      customer_name: order.customer,
      seller_name: order.salesperson,
      entry_date: order.entryDate,
      delivery_date: order.dueDate,
      summary: order.item,
      total_amount: order.total,
      note: order.note,
    },
    p_items: items,
    p_initial_payment: order.paid > 0
      ? { amount: order.paid, payment_method: order.paymentMethod }
      : null,
  })
  throwOnError(error)
}

async function findOrderId(companyId: string, orderCode: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("company_id", companyId)
    .eq("code", orderCode)
    .maybeSingle()
  throwOnError(error)
  if (!data) throw new Error(`No existe el pedido ${orderCode}.`)
  return data.id
}

export async function setSupabaseOrderDeleted(
  companyId: string,
  orderCode: string,
  action: "trash" | "restore" | "archive",
) {
  const supabase = createClient()
  const now = new Date().toISOString()
  const values = action === "trash"
    ? { deleted_at: now }
    : action === "restore"
      ? { deleted_at: null, archived_at: null }
      : { deleted_at: now, archived_at: now }
  let query = supabase
    .from("orders")
    .update(values)
    .eq("company_id", companyId)
    .eq("code", orderCode)
  if (action === "restore") query = query.is("archived_at", null)
  const { data, error } = await query.select("id").maybeSingle()
  throwOnError(error)
  if (!data) throw new Error(`No se encontró el pedido ${orderCode} o ya está archivado.`)
}

export async function addSupabasePayment(
  companyId: string,
  orderCode: string,
  amount: number,
  paymentMethod: string,
) {
  const supabase = createClient()
  const orderId = await findOrderId(companyId, orderCode)
  const { error } = await supabase.from("order_payments").insert({
    company_id: companyId,
    order_id: orderId,
    amount,
    payment_method: paymentMethod,
  })
  throwOnError(error)
}

export async function moveSupabaseOrderItems(
  companyId: string,
  orderCode: string,
  itemIds: string[],
  targetPhase: GarmentPhaseReached,
  operatorName: string,
) {
  if (!itemIds.length) return
  const supabase = createClient()
  const orderId = await findOrderId(companyId, orderCode)
  const { error } = await supabase.rpc("update_order_item_phases", {
    p_order_id: orderId,
    p_item_ids: itemIds,
    p_target_phase: targetPhase,
    p_operator_name: operatorName,
  })
  throwOnError(error)
}

export async function moveSupabaseOrder(
  companyId: string,
  orderCode: string,
  targetPhase: GarmentPhaseReached,
  operatorName: string,
) {
  const supabase = createClient()
  const orderId = await findOrderId(companyId, orderCode)
  const { error } = await supabase.rpc("update_order_production_phase", {
    p_order_id: orderId,
    p_target_phase: targetPhase,
    p_operator_name: operatorName,
  })
  throwOnError(error)
}
