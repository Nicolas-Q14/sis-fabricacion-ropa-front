insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'catalog-images',
  'catalog-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists catalog_images_public_read on storage.objects;
create policy catalog_images_public_read
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'catalog-images');

drop policy if exists catalog_images_superadmin_insert on storage.objects;
create policy catalog_images_superadmin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'catalog-images'
    and (storage.foldername(name))[1] = 'catalog'
    and exists (
      select 1
      from public.user_roles as role
      where role.user_id = (select auth.uid())
        and role.role = 'superadmin'::public.app_role
        and role.company_id is null
    )
  );

drop policy if exists catalog_images_superadmin_update on storage.objects;
create policy catalog_images_superadmin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and (storage.foldername(name))[1] = 'catalog'
    and exists (
      select 1
      from public.user_roles as role
      where role.user_id = (select auth.uid())
        and role.role = 'superadmin'::public.app_role
        and role.company_id is null
    )
  )
  with check (
    bucket_id = 'catalog-images'
    and (storage.foldername(name))[1] = 'catalog'
    and exists (
      select 1
      from public.user_roles as role
      where role.user_id = (select auth.uid())
        and role.role = 'superadmin'::public.app_role
        and role.company_id is null
    )
  );

drop policy if exists catalog_images_superadmin_delete on storage.objects;
create policy catalog_images_superadmin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and (storage.foldername(name))[1] = 'catalog'
    and exists (
      select 1
      from public.user_roles as role
      where role.user_id = (select auth.uid())
        and role.role = 'superadmin'::public.app_role
        and role.company_id is null
    )
  );
