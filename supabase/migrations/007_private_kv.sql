-- Event Hub v2 — 007 tajné hodnoty len pre server (Google Drive refresh token, OAuth state)
-- RLS zapnuté a žiadne policy = z prehliadača sa nedá čítať ani zapisovať, len service role (Edge Functions).
create table public.private_kv (
  key text primary key,
  value text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.private_kv enable row level security;
revoke all on public.private_kv from anon, authenticated;
