import { Skeleton } from "@/components/ui/skeleton"

export default function OrdersLoading() {
  return (
    <div aria-label="Cargando módulo de pedidos" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)]">
        <div className="rounded-xl border p-4">
          <Skeleton className="mb-5 h-5 w-36" />
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div className="grid grid-cols-5 gap-4" key={index}>
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
