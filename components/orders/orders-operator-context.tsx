"use client"

import { createContext, useContext, type ReactNode } from "react"

type OrdersOperator = {
  userId: string
  name: string
}

const OrdersOperatorContext = createContext<OrdersOperator | null>(null)

export function OrdersOperatorProvider({
  children,
  operator,
}: {
  children: ReactNode
  operator: OrdersOperator
}) {
  return (
    <OrdersOperatorContext.Provider value={operator}>
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
