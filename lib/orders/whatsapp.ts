import type { DemoOrder } from "@/lib/orders/demo-data"

export function getWhatsAppWebUrl(message: string) {
  return `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`
}

export function getOrderShareMessage(order: DemoOrder) {
  const items = order.items.map((item) =>
    `• ${item.garment} ${item.fit}, ${item.color}, talla ${item.size}${item.name ? ` · ${item.name}` : ""}${item.number ? ` · N.º ${item.number}` : ""}`,
  )

  return [
    `Pedido ${order.id}`,
    `Cliente: ${order.customer}`,
    `Entrega: ${order.dueDate}`,
    `Cantidad: ${order.quantity} prendas`,
    "",
    ...items,
    "",
    `Total: ${new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(order.total)}`,
  ].join("\n")
}
