insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'order-pdf-shares',
  'order-pdf-shares',
  false,
  15728640,
  array['application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy order_pdf_shares_select_company
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'order-pdf-shares'
    and public.user_can_access_company(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    )
  );

create policy order_pdf_shares_insert_company
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'order-pdf-shares'
    and public.user_can_access_company(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    )
  );

create policy order_pdf_shares_delete_company
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'order-pdf-shares'
    and public.user_can_access_company(
      case
        when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then ((storage.foldername(name))[1])::uuid
        else null
      end
    )
  );
