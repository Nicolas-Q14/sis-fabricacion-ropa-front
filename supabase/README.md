# Roles y empresas

Las migraciones `migrations/20261008211000_company_roles.sql`,
`migrations/20261008225000_global_admin.sql` y
`migrations/20261015170000_independent_user_roles.sql` configuran los roles y
las asignaciones de usuarios. La migración
`migrations/20261015180000_user_profiles.sql` agrega la sede editable por
empleado. Para el sistema de una sola empresa, los usuarios nuevos no requieren
una fila en `companies`. La migración `migrations/20261015190000_profile_photos.sql`
configura el almacenamiento de fotos de perfil.

## Aplicación

Aplica la migración al proyecto Supabase de desarrollo y luego al de producción
desde el SQL Editor de Supabase o mediante Supabase CLI después de enlazar el
proyecto. No compartas la `service_role key` ni la incluyas en el frontend.
Para habilitar la gestión de usuarios, configura `SUPABASE_SERVICE_ROLE_KEY`
solo en el entorno del servidor (por ejemplo, en `.env.local` para desarrollo).
Nunca uses el prefijo `NEXT_PUBLIC_` para esta clave.

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
coincida. Este primer superadmin es necesario para gestionar los perfiles de los
usuarios.

## Compatibilidad con asignaciones antiguas por empresa

La aplicación ya no requiere crear una empresa para registrar empleados. Las
tablas y permisos por `company_id` se conservan para no perder compatibilidad
con asignaciones o datos antiguos. Si necesitas crear una asignación antigua
por empresa, el usuario debe tener la fila correspondiente en `companies`.
Superadmin y los perfiles nuevos de administrador/producción se asignan sin
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

Los usuarios creados desde `/dashboard/usuarios` quedan asociados directamente
a la única sede lógica del sistema, no a una empresa de `companies`. La base de
datos conserva las restricciones de rol global para impedir asignaciones
duplicadas. Solo el superadmin puede asignar o cambiar roles.

## Permisos incluidos

- **Superadmin:** puede consultar y asignar perfiles a los empleados.
- **Administrador:** perfil global de administración de la única empresa.
- **Producción:** perfil global de producción de la única sede.

Los usuarios no pueden asignarse ni elevarse roles desde el cliente. Las tablas
`companies` y `user_roles` tienen Row Level Security habilitado. La migración
no modifica usuarios existentes ni asigna roles automáticamente.

## Gestión de usuarios y contraseña inicial

El módulo `/dashboard/usuarios` solo se muestra y permite crear cuentas a
usuarios con el rol `superadmin`. El superadmin registra empleados
independientes de `companies` y les asigna el perfil administrador o producción.
Puede editar la sede de cada empleado y activar o desactivar su cuenta. Una
cuenta desactivada queda bloqueada para el inicio de sesión y el acceso a la
aplicación. La contraseña temporal se genera de forma aleatoria por cuenta y se
muestra una sola vez al superadmin; debe compartirla de forma segura con el usuario.

Las cuentas nuevas llevan `must_change_password` en `app_metadata`. El servidor
bloquea el acceso al dashboard hasta que el usuario establezca una contraseña
de al menos 12 caracteres. La gestión de cuentas usa la API administrativa de
Supabase exclusivamente en rutas de servidor y requiere
`SUPABASE_SERVICE_ROLE_KEY`. Aplica también la migración
`20261015170000_independent_user_roles.sql` antes de crear usuarios sin empresa;
aplica `20261015180000_user_profiles.sql` para habilitar la gestión de sedes.
Aplica también `20261015190000_profile_photos.sql` para habilitar la subida de
fotos de perfil. Las asignaciones antiguas por `company_id` se conservan.

## Perfil y cambio de correo

Cada usuario puede editar su nombre y foto desde **Mi perfil**, en el menú de su
cuenta. Las fotos se guardan en el bucket público `profile-photos`; las políticas
de Storage solo permiten que cada usuario suba o reemplace archivos dentro de su
propia carpeta.

El cambio de correo usa el flujo de confirmación de Supabase Auth. Para que el
correo actual reciba una notificación cuando cambie la dirección, habilita
**Email address changed notification** en la configuración de notificaciones de
seguridad de Auth y configura el proveedor SMTP/correo del proyecto. La
notificación al correo anterior se envía al confirmarse el cambio; la verificación
se envía al nuevo correo. No se cambia la dirección hasta completar la
verificación que requiera la configuración de Auth.

## Pedidos e inventario para una sola empresa

La migración `migrations/20261020180000_orders_inventory_multitenant.sql`
agrega clientes, pedidos, prendas personalizadas, ocho fases de producción,
eventos de auditoría, abonos e inventario por variante y bodega. Requiere que
las migraciones anteriores hayan creado `companies`, `user_roles` y
`public.is_superadmin()`. Aplícala después de las migraciones de roles. Luego
aplica `migrations/20261021140000_single_company_orders_inventory.sql` para
quitar la dependencia de filas en `companies`.

La migración de espacio único asigna las tablas de pedidos e inventario a una
clave interna fija (`00000000-0000-0000-0000-000000000001`), no a un registro de
`companies`. Los pedidos, prendas, pagos, eventos y existencias existentes se
consolidan en ese espacio. No borra datos de `companies` ni de `user_roles`.
RLS permite consultar y operar ese espacio solo a usuarios con un rol
`superadmin`, `admin` o `gerente_produccion`; los roles globales no requieren
`company_id`.

Antes de crear pedidos, configura el catálogo, la bodega principal, las
variantes y las existencias iniciales.
Cada prenda debe asociarse a una variante y una bodega y contar con stock libre
antes de registrarse como pedido. El RPC de alta bloquea y valida existencias
para crear reservas concurrentes de forma segura. La entrega de la última
prenda ejecuta en una misma transacción el descuento de stock y el registro de
movimientos; si falta existencia, falla también el cambio de fase. Los eventos
de producción son append-only y el retroceso no borra verificaciones anteriores.

Las pantallas de pedidos, producción e inventario usan el cliente público de
Supabase y dependen de estas políticas y RPC. Ya no buscan una empresa activa en
`companies`; todos los usuarios autorizados comparten el espacio único. Los
datos antiguos de `localStorage` permanecen intactos y no se importan
automáticamente; deben migrarse por separado y vincular cada prenda con una
variante de inventario.

## Aplicación web

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el
entorno de la aplicación. La clave pública se usa desde el navegador y todas las
operaciones dependen de RLS; no incluyas la `service_role key` en el cliente.

Los módulos de pedidos, pagos, producción e inventario leen y escriben en las
tablas de estas migraciones. Las altas de pedidos, los pagos, las fases y los
movimientos de existencias usan RPC o triggers para conservar la atomicidad y
la auditoría. La interfaz usa el espacio único y actualiza los datos con
Supabase Realtime.

Las migraciones no importan los datos ya guardados en `localStorage`. Se
conservan en el navegador y deben transformarse y cargarse por separado si se
quieren mantener; antes de crear pedidos en Supabase, configura el catálogo, la
bodega principal, las variantes y las existencias.

La migración `migrations/20261021150000_inventory_catalog_management.sql`
agrega el RPC seguro para eliminar productos. Un producto solo puede borrarse
si ninguna variante está ligada a pedidos o movimientos, para conservar la
trazabilidad.

La migración `migrations/20261021160000_inventory_producer_reference.sql`
normaliza las referencias de movimientos a `Frenesi sport`: corrige las
referencias existentes y fuerza ese texto en cualquier movimiento nuevo o
actualizado, incluidos los descuentos asociados a pedidos.

La migración `migrations/20261021170000_inventory_catalog_taxonomy.sql`
organiza el catálogo por año, familia y subcategoría. El catálogo incluye
Textiles y Promocionales con sus categorías; los SKU nuevos se generan como
`FS-{año}-{familia}-{tipo}-{consecutivo}`, por ejemplo
`FS-2026-TEX-CAM-001`. Los productos existentes conservan sus SKU y se asignan
al catálogo 2026; su familia y subcategoría se infieren a partir del nombre
cuando es posible.

Si necesitas vaciar el inventario actual, ejecuta manualmente
`manual/reset_single_company_inventory.sql` desde el SQL Editor después de
hacer una copia de seguridad. No es una migración automática ni elimina tablas:
borra los productos, variantes, existencias y movimientos del espacio único,
pero conserva las bodegas, pedidos e historial de producción. Las prendas de
pedidos quedan desvinculadas de variantes y bodegas; los pedidos activos deberán
asociarse a nuevas variantes antes de completar la producción y descontar stock.
Al final, el script consulta los conteos restantes para verificar la limpieza.

La migración `migrations/20261021180000_inventory_batch_stock_adjustment.sql`
agrega el RPC para ajustes en lote. La migración
`migrations/20261021190000_inventory_reference_stock_batch.sql` agrega
`apply_inventory_reference_stock_batch`, que permite registrar una entrada o
salida en varias tallas y colores y crear variantes que aún no existen desde el
detalle de la referencia. Las nuevas variantes heredan los mínimos y máximos
de una variante existente de la referencia (o usan cero/sin máximo si aún no
hay variantes). La operación completa es transaccional y cada salida valida
las reservas activas; si una variante no tiene stock suficiente, se revierte el
lote. Aplica ambas migraciones en orden para usar **Agregar unidades por
talla/color**.

Para cargar muestras de inicio, ejecuta
`manual/seed_inventory_examples_2025_2026.sql` después de la migración de
taxonomía. Crea un ejemplo por cada subcategoría textil y promocional en los
catálogos 2025 y 2026, con variantes S/M/L y stock inicial de demostración.
El archivo es idempotente por SKU. La galería aún no tiene una tabla propia en
Supabase; `public/inventario/Frenesi Sport/galeria/trabajos_entregados/muestra-demo.svg`
es solamente una ilustración de muestra y no representa un trabajo real.

En la interfaz, crear y editar productos se hace desde formularios dedicados.
Las variantes nuevas y sus existencias iniciales se guardan al confirmar el
producto. El inventario muestra alertas de stock bajo y el dashboard comparte
esas alertas junto con los movimientos recientes. La interfaz no ofrece el formulario general de movimientos. Desde el detalle
de una referencia se pueden registrar entradas o salidas para varias tallas y
colores en un solo lote; también se conserva el ajuste individual por variante.
Las operaciones validan reservas activas y guardan el usuario autenticado en
`created_by_user_id`. El kardex muestra movimientos recientes y reservas
activas derivadas de prendas de pedidos aún no entregados.

El catálogo dispone de búsqueda y filtros por año, familia, subcategoría y
bodega. El SKU se genera con el formato
`FS-{año}-{familia}-{tipo}-{consecutivo}`. Las lecturas del módulo se realizan
desde Supabase con RLS; `loadSupabaseInventory` carga catálogo, variantes,
stock, movimientos y reservas, y el hook del inventario refresca por Realtime.
