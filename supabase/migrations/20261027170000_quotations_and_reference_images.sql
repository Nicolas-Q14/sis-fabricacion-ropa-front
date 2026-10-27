create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default '00000000-0000-0000-0000-000000000001',
  quote_number text not null,
  customer_name text not null,
  salesperson text not null,
  note text not null default '',
  entry_date date not null,
  delivery_date date not null,
  quantity integer not null check (quantity > 0),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  surcharges numeric(14, 2) not null check (surcharges >= 0),
  discounts numeric(14, 2) not null check (discounts >= 0),
  grand_total numeric(14, 2) not null check (grand_total >= 0),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  reference_images text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quotations_delivery_after_entry check (delivery_date >= entry_date),
  constraint quotations_company_number_unique unique (company_id, quote_number),
  constraint quotations_company_id_unique unique (company_id, id)
);

alter table public.quotations enable row level security;

grant select, insert, update, delete on public.quotations to authenticated;

create policy quotations_select_company
  on public.quotations
  for select
  to authenticated
  using (public.user_can_access_company(company_id));

create policy quotations_insert_company
  on public.quotations
  for insert
  to authenticated
  with check (public.user_can_access_company(company_id));

create policy quotations_update_company
  on public.quotations
  for update
  to authenticated
  using (public.user_can_access_company(company_id))
  with check (public.user_can_access_company(company_id));

create policy quotations_delete_company
  on public.quotations
  for delete
  to authenticated
  using (public.user_can_access_company(company_id));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'quotation-references',
  'quotation-references',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy quotation_references_select_company
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'quotation-references'
    and public.user_can_access_company(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    )
  );

create policy quotation_references_insert_company
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'quotation-references'
    and public.user_can_access_company(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    )
  );

create policy quotation_references_delete_company
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'quotation-references'
    and public.user_can_access_company(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    )
  );
