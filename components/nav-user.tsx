"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { appRoleLabels, type AppRole } from "@/lib/auth/roles"
import { LogOutIcon, Settings2Icon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

export function NavUser({
  user,
  role,
}: {
  user: { name: string; email: string; avatarUrl?: string | null }
  role: AppRole
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false)
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "FS"

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      const { error } = await createClient().auth.signOut()
      if (error) {
        toast.error("No se pudo cerrar la sesión. Inténtalo de nuevo.")
        setIsSigningOut(false)
        return
      }

      setIsSignOutDialogOpen(false)
      router.replace("/login")
      router.refresh()
    } catch {
      toast.error("No se pudo cerrar la sesión. Inténtalo de nuevo.")
      setIsSigningOut(false)
    }
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
              {user.avatarUrl && <AvatarImage alt="" src={user.avatarUrl} />}
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
            <DropdownMenuGroup>
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
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/perfil")}>
              <Settings2Icon />
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isSigningOut}
              onClick={() => setIsSignOutDialogOpen(true)}
            >
              <LogOutIcon />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled={isSigningOut}
          onClick={() => setIsSignOutDialogOpen(true)}
          tooltip="Cerrar sesión"
        >
          <LogOutIcon />
          <span>Cerrar sesión</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <Dialog
        onOpenChange={(open) => {
          if (!isSigningOut) setIsSignOutDialogOpen(open)
        }}
        open={isSignOutDialogOpen}
      >
        <DialogContent showCloseButton={!isSigningOut}>
          <DialogHeader>
            <DialogTitle>¿Cerrar sesión?</DialogTitle>
            <DialogDescription>
              Se cerrará tu sesión y volverás a la pantalla de inicio de sesión.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={isSigningOut}
              onClick={() => setIsSignOutDialogOpen(false)}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              variant="destructive"
            >
              {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  )
}
