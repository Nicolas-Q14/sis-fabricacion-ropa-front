import { OrderDetail } from "@/components/orders/order-detail"

export default async function OrderDetailPage({
  params,
}: PageProps<"/dashboard/orders/[id]">) {
  const { id } = await params
  return <OrderDetail orderId={id} />
}
