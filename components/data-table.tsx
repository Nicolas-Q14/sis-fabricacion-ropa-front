import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Order = {
  id: string
  garment: string
  status: string
  units: number
  delivery: string
  customer: string
}

export function DataTable({ data }: { data: Order[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos recientes</CardTitle>
        <CardDescription>
          Ejemplos de órdenes y su estado de fabricación.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Prenda</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead>Cliente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.id}</TableCell>
                <TableCell>{order.garment}</TableCell>
                <TableCell>
                  <Badge variant={order.status === "Listo" ? "default" : "outline"}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{order.units}</TableCell>
                <TableCell>{order.delivery}</TableCell>
                <TableCell>{order.customer}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
