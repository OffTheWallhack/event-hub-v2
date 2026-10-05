-- Event Hub v2 — 006 ICS sync cez cron (každých 15 min)
-- Cron volá Edge Function ics-sync s náhodným tajomstvom z app_settings (admin-only RLS).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

insert into public.app_settings (key, value)
values ('sync_cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

select cron.unschedule('ics-sync') where exists (select 1 from cron.job where jobname = 'ics-sync');

select cron.schedule(
  'ics-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://znsrokpaoczljisaoulu.supabase.co/functions/v1/ics-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_settings where key = 'sync_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
