-- Event Hub v2 — 011 súkromný priečinok `event-photos` na fotky z eventov (pre export pre šéfa).
-- Nie je verejný: obrázky sa zobrazujú cez dočasné podpísané odkazy.
-- Čítať môžu schválení používatelia, nahrávať / meniť / mazať len admin.
-- Cesta súboru = event_photos.path (`<event_id>/<čas>-<náhodné>.jpg`), rovnaký tvar ako v starej appke.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy event_photos_files_read on storage.objects for select to authenticated
  using (bucket_id = 'event-photos' and public.is_approved());
create policy event_photos_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos' and public.is_admin());
create policy event_photos_files_update on storage.objects for update to authenticated
  using (bucket_id = 'event-photos' and public.is_admin()) with check (bucket_id = 'event-photos' and public.is_admin());
create policy event_photos_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'event-photos' and public.is_admin());

create index if not exists event_photos_event_idx on public.event_photos (event_id);
