export const appRoles = ['superadmin', 'admin', 'gerente_produccion'] as const

export type AppRole = (typeof appRoles)[number]

export type CompanyOption = {
  id: string
  name: string
}

export const appRoleLabels: Record<AppRole, string> = {
  superadmin: 'Superadministrador',
  admin: 'Administrador de empresa',
  gerente_produccion: 'Gerente de producción',
}

export function isAppRole(role: string): role is AppRole {
  return appRoles.includes(role as AppRole)
}
