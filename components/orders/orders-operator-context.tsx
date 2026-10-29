"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { AppRole } from "@/lib/auth/roles"

type OrdersOperator = {
  userId: string
  name: string
  companyId: string
  role: AppRole
}

const OrdersOperatorContext = createContext<OrdersOperator | null>(null)

export function OrdersOperatorProvider({
  children,
  companyId,
  operator,
  role,
}: {
  children: ReactNode
  companyId: string
  operator: Omit<OrdersOperator, "companyId" | "role">
  role: AppRole
}) {
  const value = { ...operator, companyId, role }
  return (
    <OrdersOperatorContext.Provider value={value}>
      {children}
    </OrdersOperatorContext.Provider>
  )
}

export function useOrdersOperator() {
  const operator = useContext(OrdersOperatorContext)
  if (!operator) {
    throw new Error("useOrdersOperator debe utilizarse dentro de OrdersOperatorProvider.")
  }
  return operator
}
