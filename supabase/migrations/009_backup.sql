-- Event Hub v2 — 009 zálohy: výpis všetkých tabuliek do JSON + cron každú hodinu
-- (Edge Function `backup` sama rozhodne, že zálohuje o polnoci a o 12:00 slovenského času.)
-- backup_dump() je len pre service role (Edge Function), z prehliadača sa nedá zavolať.
create or replace function public.backup_dump()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  j jsonb;
  res jsonb := '{}'::jsonb;
begin
  for r in select tablename from pg_tables where schemaname = 'public' and tablename <> 'private_kv' order by tablename loop
    if r.tablename = 'app_settings' then
      -- tajné hodnoty do zálohy nepatria
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into j from public.app_settings t where t.key not ilike '%secret%';
    else
      execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t', r.tablename) into j;
    end if;
    res := res || jsonb_build_object(r.tablename, j);
  end loop;
  return res;
end;
$$;
revoke all on function public.backup_dump() from public, anon, authenticated;
grant execute on function public.backup_dump() to service_role;

select cron.unschedule('backup-hourly') where exists (select 1 from cron.job where jobname = 'backup-hourly');
select cron.schedule(
  'backup-hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://znsrokpaoczljisaoulu.supabase.co/functions/v1/backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_settings where key = 'sync_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
