"use client"

import { createContext, useContext, type ReactNode } from "react"

type OrdersOperator = {
  userId: string
  name: string
  companyId: string
}

const OrdersOperatorContext = createContext<OrdersOperator | null>(null)

export function OrdersOperatorProvider({
  children,
  companyId,
  operator,
}: {
  children: ReactNode
  companyId: string
  operator: Omit<OrdersOperator, "companyId">
}) {
  const value = { ...operator, companyId }
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
