'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckIcon, ClipboardIcon, PowerIcon, UserPlusIcon } from 'lucide-react'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'

export type ManagedUser = {
  id: string
  email: string
  fullName: string
  role: 'admin' | 'gerente_produccion'
  branch: string
  mustChangePassword: boolean
  isActive: boolean
}

type UserManagementClientProps = {
  avatarUrl: string | null
  email: string
  fullName: string
  users: ManagedUser[]
}

export function UserManagementClient({
  avatarUrl,
  email,
  fullName,
  users: initialUsers,
}: UserManagementClientProps) {
  const router = useRouter()
  const [users, setUsers] = useState(initialUsers)
  const [name, setName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'gerente_produccion'>('admin')
  const [branch, setBranch] = useState('Sede única')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users
    return users.filter((user) =>
      `${user.fullName} ${user.email} ${user.branch} ${user.role}`
        .toLowerCase()
        .includes(query),
    )
  }, [search, users])

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setCreatedPassword(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name,
          email: newEmail,
          role,
          branch,
        }),
      })
      const result: {
        error?: string
        user?: ManagedUser
        temporaryPassword?: string
      } = await response.json()

      if (!response.ok || !result.user || !result.temporaryPassword) {
        setError(result.error ?? 'No se pudo crear el usuario. Inténtalo de nuevo.')
        return
      }

      const createdUser = result.user
      const temporaryPassword = result.temporaryPassword
      setUsers((current) => [createdUser, ...current])
      setCreatedPassword(temporaryPassword)
      setName('')
      setNewEmail('')
      setBranch('Sede única')
      router.refresh()
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateUser(
    user: ManagedUser,
    updates: { branch?: string; isActive?: boolean },
  ) {
    setUpdatingUserId(user.id)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: updates.branch ?? user.branch,
          isActive: updates.isActive ?? user.isActive,
        }),
      })
      const result: {
        error?: string
        user?: { id: string; branch: string; isActive: boolean }
      } = await response.json()

      if (!response.ok || !result.user) {
        toast.error(result.error ?? 'No se pudieron guardar los cambios.')
        return
      }

      setUsers((current) => current.map((item) =>
        item.id === result.user?.id
          ? { ...item, branch: result.user.branch, isActive: result.user.isActive }
          : item,
      ))
      toast.success('Cambios guardados.')
      router.refresh()
    } catch {
      toast.error('No se pudo conectar con el servidor. Inténtalo de nuevo.')
    } finally {
      setUpdatingUserId(null)
    }
  }

  async function handleCopyPassword() {
    if (!createdPassword) return

    try {
      await navigator.clipboard.writeText(createdPassword)
      toast.success('Contraseña temporal copiada.')
    } catch {
      toast.error('No se pudo copiar la contraseña. Selecciónala y cópiala manualmente.')
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar
        companyId={null}
        companyName="Sede única"
        companies={[]}
        role="superadmin"
        user={{ name: fullName.trim() || email || 'Superadmin', email, avatarUrl }}
      />
      <SidebarInset>
        <SiteHeader companyName="Sede única" role="superadmin" />
        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Administración del sistema</p>
            <h1 className="text-2xl font-semibold tracking-tight">Gestión de usuarios</h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los empleados y los perfiles que tienen asignados.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Registrar empleado</CardTitle>
              <CardDescription>
                Registra el correo y el nombre del empleado, asígnale el perfil de
                administrador o producción y comparte su contraseña temporal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateUser}>
                <label className="grid gap-2 text-sm font-medium" htmlFor="new-user-name">
                  Nombre completo
                  <Input
                    autoComplete="name"
                    id="new-user-name"
                    maxLength={100}
                    minLength={2}
                    onChange={(event) => setName(event.target.value)}
                    required
                    value={name}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="new-user-email">
                  Correo electrónico
                  <Input
                    autoComplete="email"
                    id="new-user-email"
                    onChange={(event) => setNewEmail(event.target.value)}
                    required
                    type="email"
                    value={newEmail}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="new-user-role">
                  Perfil
                  <select
                    className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                    id="new-user-role"
                    onChange={(event) => {
                      if (
                        event.target.value === 'admin'
                        || event.target.value === 'gerente_produccion'
                      ) {
                        setRole(event.target.value)
                      }
                    }}
                    value={role}
                  >
                    <option value="admin">Administrador</option>
                    <option value="gerente_produccion">Producción</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="new-user-branch">
                  Sede
                  <Input
                    id="new-user-branch"
                    maxLength={100}
                    onChange={(event) => setBranch(event.target.value)}
                    required
                    value={branch}
                  />
                </label>
                {error && (
                  <p className="text-sm text-destructive md:col-span-2" role="alert">
                    {error}
                  </p>
                )}
                <div className="md:col-span-2">
                  <Button disabled={isSubmitting} type="submit">
                    <UserPlusIcon />
                    {isSubmitting ? 'Registrando empleado…' : 'Registrar empleado'}
                  </Button>
                </div>
              </form>
              {createdPassword && (
                <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-semibold">Copia y comparte esta contraseña temporal ahora.</p>
                  <p className="mt-1">No volverá a mostrarse y deberá cambiarse en el primer inicio de sesión.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="rounded bg-background/70 px-2 py-1 font-mono">{createdPassword}</code>
                    <Button onClick={handleCopyPassword} size="sm" type="button" variant="outline">
                      <ClipboardIcon />
                      Copiar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usuarios registrados</CardTitle>
              <CardDescription>Empleados registrados y perfiles asignados en la sede.</CardDescription>
              <Input
                aria-label="Buscar usuarios"
                className="mt-2 max-w-sm"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, correo o perfil"
                value={search}
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Sede</TableHead>
                    <TableHead>Estado de acceso</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((item) => (
                    <TableRow key={`${item.id}-${item.role}-${item.branch}`}>
                      <TableCell>
                        <div className="font-medium">{item.fullName || 'Sin nombre'}</div>
                        <div className="text-xs text-muted-foreground">{item.email}</div>
                      </TableCell>
                      <TableCell>
                        {item.role === 'admin' ? 'Administrador' : 'Producción'}
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-48 items-center gap-2">
                          <Input
                            aria-label={`Sede de ${item.fullName || item.email}`}
                            className="h-8"
                            maxLength={100}
                            onChange={(event) => {
                              const branch = event.target.value
                              setUsers((current) => current.map((user) =>
                                user.id === item.id ? { ...user, branch } : user,
                              ))
                            }}
                            value={item.branch}
                          />
                          <Button
                            aria-label={`Guardar sede de ${item.fullName || item.email}`}
                            disabled={updatingUserId === item.id || !item.branch.trim()}
                            onClick={() => updateUser(item, { branch: item.branch })}
                            size="icon-sm"
                            title="Guardar sede"
                            type="button"
                            variant="outline"
                          >
                            <CheckIcon />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={item.isActive ? 'secondary' : 'destructive'}>
                            {item.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                          {item.isActive && item.mustChangePassword && (
                            <span className="text-xs text-muted-foreground">
                              Debe cambiar contraseña
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          disabled={updatingUserId === item.id}
                          onClick={() => updateUser(item, { isActive: !item.isActive })}
                          size="sm"
                          type="button"
                          variant={item.isActive ? 'outline' : 'default'}
                        >
                          <PowerIcon />
                          {item.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell className="h-24 text-center text-muted-foreground" colSpan={5}>
                        {users.length === 0 ? 'Aún no hay usuarios registrados.' : 'No se encontraron usuarios.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
