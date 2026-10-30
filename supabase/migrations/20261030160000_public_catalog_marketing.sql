create table if not exists public.public_catalog_banner (
  id boolean primary key default true check (id),
  image_path text,
  image_url text,
  alt_text text not null default '',
  updated_at timestamptz not null default now(),
  constraint public_catalog_banner_image_pair check (
    (image_path is null) = (image_url is null)
  ),
  constraint public_catalog_banner_image_url check (
    image_url is null or length(trim(image_url)) > 0
  ),
  constraint public_catalog_banner_image_path check (
    image_path is null or image_path like 'marketing/banner/%'
  ),
  constraint public_catalog_banner_alt_text check (
    image_path is null or length(trim(alt_text)) between 1 and 200
  )
);

insert into public.public_catalog_banner (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.public_catalog_carousel (
  id uuid primary key default gen_random_uuid(),
  image_path text not null check (image_path like 'marketing/carousel/%'),
  image_url text not null check (length(trim(image_url)) > 0),
  alt_text text not null check (length(trim(alt_text)) between 1 and 200),
  title text check (title is null or length(trim(title)) between 1 and 120),
  subtitle text check (subtitle is null or length(trim(subtitle)) between 1 and 240),
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_catalog_footer (
  id boolean primary key default true check (id),
  background_path text,
  background_url text,
  title text not null default '¿Necesitas ayuda?'
    check (length(trim(title)) between 1 and 120),
  description text not null default 'Contáctanos para recibir atención personalizada.'
    check (length(trim(description)) between 1 and 240),
  whatsapp_phone text not null default ''
    check (whatsapp_phone = '' or whatsapp_phone ~ '^[0-9]{8,15}$'),
  whatsapp_label text not null default 'Escríbenos por WhatsApp'
    check (length(trim(whatsapp_label)) between 1 and 80),
  qr_path text,
  qr_url text,
  qr_alt text not null default 'Código QR para contactar por WhatsApp'
    check (length(trim(qr_alt)) between 1 and 200),
  updated_at timestamptz not null default now(),
  constraint public_catalog_footer_background_pair check (
    (background_path is null) = (background_url is null)
  ),
  constraint public_catalog_footer_background_path check (
    background_path is null or background_path like 'marketing/footer/%'
  ),
  constraint public_catalog_footer_background_url check (
    background_url is null or length(trim(background_url)) > 0
  ),
  constraint public_catalog_footer_qr_pair check (
    (qr_path is null) = (qr_url is null)
  ),
  constraint public_catalog_footer_qr_path check (
    qr_path is null or qr_path like 'marketing/footer-qr/%'
  ),
  constraint public_catalog_footer_qr_url check (
    qr_url is null or length(trim(qr_url)) > 0
  )
);

insert into public.public_catalog_footer (id)
values (true)
on conflict (id) do nothing;

create index if not exists public_catalog_carousel_public_order_idx
  on public.public_catalog_carousel (sort_order, created_at);

alter table public.public_catalog_banner enable row level security;
alter table public.public_catalog_carousel enable row level security;
alter table public.public_catalog_footer enable row level security;

grant select on public.public_catalog_banner to anon, authenticated;
grant insert, update on public.public_catalog_banner to authenticated;
grant select on public.public_catalog_carousel to anon, authenticated;
grant insert, update, delete on public.public_catalog_carousel to authenticated;
grant select on public.public_catalog_footer to anon, authenticated;
grant insert, update on public.public_catalog_footer to authenticated;

drop policy if exists public_catalog_banner_public_read
  on public.public_catalog_banner;
create policy public_catalog_banner_public_read
  on public.public_catalog_banner
  for select
  to anon, authenticated
  using (true);

drop policy if exists public_catalog_banner_superadmin_insert
  on public.public_catalog_banner;
create policy public_catalog_banner_superadmin_insert
  on public.public_catalog_banner
  for insert
  to authenticated
  with check ((select public.is_superadmin()));

drop policy if exists public_catalog_banner_superadmin_update
  on public.public_catalog_banner;
create policy public_catalog_banner_superadmin_update
  on public.public_catalog_banner
  for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists public_catalog_carousel_public_read
  on public.public_catalog_carousel;
create policy public_catalog_carousel_public_read
  on public.public_catalog_carousel
  for select
  to anon
  using (is_active);

drop policy if exists public_catalog_carousel_authenticated_read
  on public.public_catalog_carousel;
create policy public_catalog_carousel_authenticated_read
  on public.public_catalog_carousel
  for select
  to authenticated
  using (is_active or (select public.is_superadmin()));

drop policy if exists public_catalog_carousel_superadmin_insert
  on public.public_catalog_carousel;
create policy public_catalog_carousel_superadmin_insert
  on public.public_catalog_carousel
  for insert
  to authenticated
  with check ((select public.is_superadmin()));

drop policy if exists public_catalog_carousel_superadmin_update
  on public.public_catalog_carousel;
create policy public_catalog_carousel_superadmin_update
  on public.public_catalog_carousel
  for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists public_catalog_carousel_superadmin_delete
  on public.public_catalog_carousel;
create policy public_catalog_carousel_superadmin_delete
  on public.public_catalog_carousel
  for delete
  to authenticated
  using ((select public.is_superadmin()));

drop policy if exists public_catalog_footer_public_read
  on public.public_catalog_footer;
create policy public_catalog_footer_public_read
  on public.public_catalog_footer
  for select
  to anon, authenticated
  using (true);

drop policy if exists public_catalog_footer_superadmin_insert
  on public.public_catalog_footer;
create policy public_catalog_footer_superadmin_insert
  on public.public_catalog_footer
  for insert
  to authenticated
  with check ((select public.is_superadmin()));

drop policy if exists public_catalog_footer_superadmin_update
  on public.public_catalog_footer;
create policy public_catalog_footer_superadmin_update
  on public.public_catalog_footer
  for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists catalog_images_superadmin_insert on storage.objects;
create policy catalog_images_superadmin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'catalog-images'
    and (
      (storage.foldername(name))[1] = 'catalog'
      or (
        (storage.foldername(name))[1] = 'marketing'
        and (storage.foldername(name))[2] in ('banner', 'carousel', 'footer', 'footer-qr')
      )
    )
    and (select public.is_superadmin())
  );

drop policy if exists catalog_images_superadmin_update on storage.objects;
create policy catalog_images_superadmin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and (
      (storage.foldername(name))[1] = 'catalog'
      or (
        (storage.foldername(name))[1] = 'marketing'
        and (storage.foldername(name))[2] in ('banner', 'carousel', 'footer', 'footer-qr')
      )
    )
    and (select public.is_superadmin())
  )
  with check (
    bucket_id = 'catalog-images'
    and (
      (storage.foldername(name))[1] = 'catalog'
      or (
        (storage.foldername(name))[1] = 'marketing'
        and (storage.foldername(name))[2] in ('banner', 'carousel', 'footer', 'footer-qr')
      )
    )
    and (select public.is_superadmin())
  );

drop policy if exists catalog_images_superadmin_delete on storage.objects;
create policy catalog_images_superadmin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'catalog-images'
    and (
      (storage.foldername(name))[1] = 'catalog'
      or (
        (storage.foldername(name))[1] = 'marketing'
        and (storage.foldername(name))[2] in ('banner', 'carousel', 'footer', 'footer-qr')
      )
    )
    and (select public.is_superadmin())
  );
