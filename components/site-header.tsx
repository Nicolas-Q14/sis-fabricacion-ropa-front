import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { appRoleLabels, type AppRole } from "@/lib/auth/roles"

export function SiteHeader({
  companyName,
  role,
}: {
  companyName: string | null
  role: AppRole
}) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 h-4 data-vertical:self-auto"
        />
        <div className="min-w-0">
          <h1 className="truncate text-base font-medium">Frenesi Sport</h1>
          <p className="truncate text-xs text-muted-foreground">
            {companyName ?? "Todas las empresas"} · {appRoleLabels[role]}
          </p>
        </div>
        <span className="ml-auto hidden text-sm text-muted-foreground md:block">
          {new Intl.DateTimeFormat("es-CO", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date())}
        </span>
      </div>
    </header>
  )
}
