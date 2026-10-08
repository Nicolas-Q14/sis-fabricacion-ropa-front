"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/client"
import { appRoleLabels, type AppRole } from "@/lib/auth/roles"
import { LogOutIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

export function NavUser({
  user,
  role,
}: {
  user: { name: string; email: string }
  role: AppRole
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "FS"

  async function handleSignOut() {
    setIsSigningOut(true)
    const { error } = await createClient().auth.signOut()
    if (error) {
      toast.error("No se pudo cerrar la sesión. Inténtalo de nuevo.")
      setIsSigningOut(false)
      return
    }
    router.replace("/login")
    router.refresh()
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-foreground/70">
                {user.email}
              </span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2">
                <UserRoundIcon className="size-4 text-muted-foreground" />
                <div className="grid text-sm">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {appRoleLabels[role]}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isSigningOut}
              onClick={handleSignOut}
            >
              <LogOutIcon />
              {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
