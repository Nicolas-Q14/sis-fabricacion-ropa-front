# Roles y empresas

Las migraciones `migrations/20261008211000_company_roles.sql` y
`migrations/20261008225000_global_admin.sql` crean los roles `superadmin`,
`admin` global y `gerente_produccion` por empresa, junto con las empresas y las
asignaciones de usuarios.

## Aplicación

Aplica la migración al proyecto Supabase de desarrollo y luego al de producción
desde el SQL Editor de Supabase o mediante Supabase CLI después de enlazar el
proyecto. No compartas la `service_role key` ni la incluyas en el frontend.

## Primer superadmin

Después de aplicar la migración, reemplaza el correo por el de un usuario que ya
exista en **Authentication → Users** y ejecuta este SQL en el SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'superadmin'::public.app_role
from auth.users
where email = lower('correo-del-superadmin@ejemplo.com')
on conflict do nothing;
```

Si no se inserta ninguna fila, verifica que el usuario ya exista y que el correo
coincida. Este primer superadmin es necesario para crear empresas y asignar los
roles de sus usuarios.

## Crear una empresa y asignar un rol

Primero crea la empresa como superadmin y copia el UUID devuelto:

```sql
insert into public.companies (name)
values ('Nombre de la empresa')
returning id;
```

Para asignar `gerente_produccion`, usa el UUID de un usuario existente y el UUID
de la empresa:

```sql
insert into public.user_roles (user_id, role, company_id, assigned_by)
values (
  'UUID-DEL-USUARIO'::uuid,
  'gerente_produccion',
  'UUID-DE-LA-EMPRESA'::uuid,
  'UUID-DEL-SUPERADMIN'::uuid
);
```

Reemplaza los tres UUID de ejemplo. Superadmin y admin global se asignan sin
`company_id`:

```sql
insert into public.user_roles (user_id, role, assigned_by)
select u.id, 'admin'::public.app_role, s.id
from auth.users as u
cross join auth.users as s
where lower(u.email) = lower('edwin@frenesi.com')
  and lower(s.email) = lower('tech@frenesi.com')
on conflict do nothing
returning user_id, role, company_id;
```

Un usuario solo puede tener un rol global de cada tipo y un rol por empresa.
Solo el superadmin puede asignar o cambiar roles.

## Permisos incluidos

- **Superadmin:** acceso global a empresas y asignaciones; puede crear/eliminar
  empresas y asignar o cambiar roles.
- **Admin global:** puede consultar, crear, actualizar y eliminar empresas; no
  puede asignar roles.
- **Gerente de producción:** puede consultar su empresa. Las políticas para
  pedidos, producción e inventario deben añadirse a las tablas de esos módulos
  cuando existan, restringiendo cada fila por `company_id` y usando
  `has_company_role(company_id, ARRAY['gerente_produccion']::public.app_role[])`.

Los usuarios no pueden asignarse ni elevarse roles desde el cliente. Las tablas
`companies` y `user_roles` tienen Row Level Security habilitado. La migración
no modifica usuarios existentes ni asigna roles automáticamente.

## Aplicación web

La ruta `/dashboard` consulta el usuario, sus roles y las empresas permitidas en
el servidor. Si no encuentra un rol o la consulta RLS falla, niega el acceso y
muestra cómo proceder. Cuando un usuario tiene varias empresas, puede elegir el
contexto activo desde el menú lateral; superadmin y admin global pueden elegir
cualquier empresa o entrar a su panel global si todavía no hay empresas.

Los pedidos, inventario, producción e indicadores que aparecen actualmente en
el dashboard siguen siendo datos de demostración. No están conectados a tablas
reales ni aislados por empresa; sus políticas RLS deberán definirse al crear
esas tablas, siempre incluyendo `company_id`.
