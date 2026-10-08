import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const indicators = [
  { label: "Pedidos activos", value: "18", description: "En proceso de fabricación" },
  { label: "En corte", value: "6", description: "Órdenes en etapa de corte" },
  { label: "En confección", value: "8", description: "Órdenes en confección" },
  { label: "Listos para entrega", value: "4", description: "Pedidos finalizados" },
]

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {indicators.map((indicator) => (
        <Card key={indicator.label} className="@container/card">
          <CardHeader>
            <CardDescription>{indicator.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {indicator.value}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {indicator.description}
            </p>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
