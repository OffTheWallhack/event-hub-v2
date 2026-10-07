-- Event Hub v2 — 008 verejný priečinok `media` na obrázky príchutí, techniky a áut (logá, fotky).
-- Čítať môže ktokoľvek (verejný priečinok), nahrávať / meniť / mazať len admin.
-- Bločky a fotky z eventov sem nepatria (idú do Google Drive).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 10485760, array['image/png','image/jpeg','image/webp','image/avif','image/gif'])
on conflict (id) do nothing;

create policy media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
create policy media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
create policy media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
