export const productionStages = [
  { id: "diseno", name: "Diseño" },
  { id: "corte", name: "Corte" },
  { id: "estampado", name: "Sublimación / Estampado" },
  { id: "confeccion", name: "Confección" },
  { id: "calidad", name: "Control de calidad" },
  { id: "empacado", name: "Empacado" },
] as const

export type ProductionStageId = (typeof productionStages)[number]["id"]
export const garmentProductionPhases = [
  { id: 1, name: "Diseño" },
  { id: 2, name: "Interpretación de Orden / Taller" },
  { id: 3, name: "Revisión de Papel" },
  { id: 4, name: "Corte Tela y Organizar Tela para Sublimar" },
  { id: 5, name: "Sublimación" },
  { id: 6, name: "Revisión de Piezas / Producto Terminado" },
  { id: 7, name: "Control de calidad" },
  { id: 8, name: "Entregado" },
] as const

export type GarmentPhase = (typeof garmentProductionPhases)[number]["id"]
export type GarmentPhaseReached = 0 | GarmentPhase
export type PhaseVerification = {
  phase: GarmentPhase
  userId: string
  operator: string
  verifiedAt: string
}
export type OrderStatus = (typeof garmentProductionPhases)[number]["name"]
export type PaymentStatus = "Pendiente" | "Abonado" | "Pagado"

export type OrderGarment = {
  garment: string
  fit: string
  size: string
  name: string
  number: string
  notes: string
  unitPrice?: number
  priceManuallyEdited?: boolean
  adjustment?: {
    type: "surcharge" | "discount"
    mode: "fixed" | "percent"
    value: number
    note: string
    enabled: boolean
  }
  netPrice?: number
  production?: {
    currentPhase: GarmentPhaseReached
    verifications: PhaseVerification[]
  }
}

export type DemoOrder = {
  id: string
  customer: string
  item: string
  quantity: number
  dueDate: string
  status: OrderStatus
  stage: ProductionStageId
  progress: number
  total: number
  paid: number
  paymentMethod?: string | null
  paymentStatus?: "Pendiente" | "Abonado" | "Pagado"
  salesperson: string
  note: string
  items: OrderGarment[]
  timeline: { date: string; title: string; operator: string }[]
}

export function isProductionStageId(value: string): value is ProductionStageId {
  return productionStages.some((stage) => stage.id === value)
}

export function isGarmentPhaseReached(value: number): value is GarmentPhaseReached {
  return Number.isInteger(value) && value >= 0 && value <= garmentProductionPhases.length
}

export function getGarmentPhase(item: OrderGarment): GarmentPhaseReached {
  return item.production?.currentPhase ?? 0
}

export function getOrderProgress(order: Pick<DemoOrder, "items">) {
  if (order.items.length === 0) return 0
  const totalPhaseProgress = order.items.reduce(
    (total, item) => total + getGarmentPhase(item) / garmentProductionPhases.length * 100,
    0,
  )
  return Math.round(totalPhaseProgress / order.items.length * 10) / 10
}

export function getOrderStatus(order: Pick<DemoOrder, "items">): OrderStatus {
  if (
    order.items.length > 0
    && order.items.every((item) => getGarmentPhase(item) === garmentProductionPhases.length)
  ) {
    return garmentProductionPhases[garmentProductionPhases.length - 1].name
  }

  const progress = getOrderProgress(order)
  const statusIndex = Math.min(
    garmentProductionPhases.length - 2,
    Math.floor(progress / (100 / garmentProductionPhases.length)),
  )
  return garmentProductionPhases[statusIndex].name
}

export function getPredominantPhase(order: Pick<DemoOrder, "items">): GarmentPhaseReached {
  const counts = new Map<GarmentPhaseReached, number>()
  for (const item of order.items) {
    const phase = getGarmentPhase(item)
    counts.set(phase, (counts.get(phase) ?? 0) + 1)
  }

  return [...counts.entries()].reduce<{
    phase: GarmentPhaseReached
    count: number
  }>(
    (predominant, [phase, count]) => count > predominant.count
      ? { phase, count }
      : predominant,
    { phase: 0, count: 0 },
  ).phase
}

export function getPhaseName(phase: GarmentPhaseReached) {
  return phase === 0
    ? "Sin iniciar"
    : garmentProductionPhases.find((item) => item.id === phase)?.name ?? "Sin iniciar"
}

export function getPhaseDistributionSummary(order: Pick<DemoOrder, "items">) {
  const counts = new Map<GarmentPhaseReached, number>()
  for (const item of order.items) {
    const phase = getGarmentPhase(item)
    counts.set(phase, (counts.get(phase) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort(([phaseA], [phaseB]) => phaseB - phaseA)
    .map(([phase, count]) => `${count}/${order.items.length} en ${getPhaseName(phase)} (Fase ${phase})`)
    .join(" · ")
}

export function updateGarmentProduction(
  item: OrderGarment,
  targetPhase: GarmentPhaseReached,
  operator: { userId: string; name: string },
): OrderGarment {
  const currentPhase = getGarmentPhase(item)
  if (targetPhase > currentPhase + 1) {
    throw new Error("Cada prenda debe completar las fases en orden, una a la vez.")
  }
  const existingVerifications = item.production?.verifications ?? []
  const verificationsByPhase = new Map(
    existingVerifications.map((verification) => [verification.phase, verification]),
  )

  if (targetPhase > currentPhase) {
    const verifiedAt = new Date().toISOString()
    for (let phase = currentPhase + 1; phase <= targetPhase; phase += 1) {
      const validPhase = garmentProductionPhases.find((item) => item.id === phase)
      if (!validPhase) continue
      verificationsByPhase.set(validPhase.id, {
        phase: validPhase.id,
        userId: operator.userId,
        operator: operator.name,
        verifiedAt,
      })
    }
  } else if (targetPhase < currentPhase) {
    for (const phase of verificationsByPhase.keys()) {
      if (phase > targetPhase) verificationsByPhase.delete(phase)
    }
  }

  return {
    ...item,
    production: {
      currentPhase: targetPhase,
      verifications: [...verificationsByPhase.values()]
        .sort((verificationA, verificationB) => verificationA.phase - verificationB.phase),
    },
  }
}

export function updateGarmentProductionForOrderMove(
  item: OrderGarment,
  targetPhase: GarmentPhaseReached,
  operator: { userId: string; name: string },
): OrderGarment {
  const currentPhase = getGarmentPhase(item)
  const verificationsByPhase = new Map(
    (item.production?.verifications ?? []).map((verification) => [
      verification.phase,
      verification,
    ]),
  )

  if (targetPhase > currentPhase) {
    const verifiedAt = new Date().toISOString()
    for (let phase = currentPhase + 1; phase <= targetPhase; phase += 1) {
      const stage = garmentProductionPhases.find((candidate) => candidate.id === phase)
      if (!stage) continue
      verificationsByPhase.set(stage.id, {
        phase: stage.id,
        userId: operator.userId,
        operator: operator.name,
        verifiedAt,
      })
    }
  } else if (targetPhase < currentPhase) {
    for (const phase of verificationsByPhase.keys()) {
      if (phase > targetPhase) verificationsByPhase.delete(phase)
    }
  }

  return {
    ...item,
    production: {
      currentPhase: targetPhase,
      verifications: [...verificationsByPhase.values()]
        .sort((verificationA, verificationB) => verificationA.phase - verificationB.phase),
    },
  }
}

export const demoOrders: DemoOrder[] = [
  {
    id: "FS-2084",
    customer: "Club Deportivo Norte",
    item: "Camiseta deportiva",
    quantity: 36,
    dueDate: "2026-10-20",
    status: "Diseño",
    stage: "estampado",
    progress: 48,
    total: 2160000,
    paid: 1080000,
    salesperson: "María Gómez",
    note: "Confirmar colores de la segunda equipación antes de confección.",
    items: [
      { garment: "Camiseta", fit: "Hombre", size: "M", name: "PÉREZ", number: "10", notes: "Parche liga en manga derecha" },
      { garment: "Camiseta", fit: "Mujer", size: "S", name: "LÓPEZ", number: "7", notes: "Corte entallado" },
      { garment: "Pantaloneta", fit: "Hombre", size: "L", name: "", number: "10", notes: "" },
    ],
    timeline: [
      { date: "16 oct · 9:42 a. m.", title: "Pedido registrado", operator: "María Gómez" },
      { date: "16 oct · 11:18 a. m.", title: "Diseños aprobados", operator: "Andrés Peña" },
      { date: "17 oct · 8:05 a. m.", title: "Corte completado", operator: "Laura Ríos" },
      { date: "17 oct · 10:26 a. m.", title: "En sublimación", operator: "Camila Ortiz" },
    ],
  },
  {
    id: "FS-2083",
    customer: "Colegio San Marcos",
    item: "Sudadera institucional",
    quantity: 52,
    dueDate: "2026-10-22",
    status: "Diseño",
    stage: "confeccion",
    progress: 68,
    total: 3900000,
    paid: 1950000,
    salesperson: "Andrés Peña",
    note: "Entregar por cursos en bolsas separadas.",
    items: [
      { garment: "Sudadera", fit: "Infantil", size: "12", name: "", number: "", notes: "Curso 6A" },
      { garment: "Sudadera", fit: "Infantil", size: "14", name: "", number: "", notes: "Curso 6B" },
    ],
    timeline: [
      { date: "15 oct · 2:10 p. m.", title: "Pedido registrado", operator: "Andrés Peña" },
      { date: "16 oct · 1:30 p. m.", title: "Corte completado", operator: "Laura Ríos" },
      { date: "17 oct · 9:15 a. m.", title: "Confección iniciada", operator: "Camila Ortiz" },
    ],
  },
  {
    id: "FS-2082",
    customer: "Academia Halcones",
    item: "Uniforme de fútbol",
    quantity: 24,
    dueDate: "2026-10-18",
    status: "Diseño",
    stage: "calidad",
    progress: 88,
    total: 1680000,
    paid: 1680000,
    salesperson: "María Gómez",
    note: "Prioridad alta: torneo el sábado.",
    items: [
      { garment: "Camiseta", fit: "Hombre", size: "L", name: "RAMÍREZ", number: "9", notes: "" },
      { garment: "Pantaloneta", fit: "Hombre", size: "L", name: "", number: "9", notes: "" },
    ],
    timeline: [
      { date: "14 oct · 10:04 a. m.", title: "Pedido registrado", operator: "María Gómez" },
      { date: "15 oct · 3:45 p. m.", title: "Estampado completado", operator: "Camila Ortiz" },
      { date: "17 oct · 11:12 a. m.", title: "Control de calidad", operator: "Laura Ríos" },
    ],
  },
  {
    id: "FS-2081",
    customer: "Eventos La 70",
    item: "Camiseta promocional",
    quantity: 80,
    dueDate: "2026-10-25",
    status: "Diseño",
    stage: "diseno",
    progress: 10,
    total: 2400000,
    paid: 600000,
    salesperson: "Andrés Peña",
    note: "Pendiente aprobación del arte final.",
    items: [
      { garment: "Camiseta", fit: "Hombre", size: "M", name: "", number: "", notes: "Logo frontal centrado" },
    ],
    timeline: [
      { date: "17 oct · 4:28 p. m.", title: "Pedido registrado", operator: "Andrés Peña" },
    ],
  },
]

export function getPaymentStatus(order: DemoOrder): PaymentStatus {
  if (order.paid <= 0) return "Pendiente"
  if (order.paid >= order.total) return "Pagado"
  return "Abonado"
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T12:00:00`))
}
