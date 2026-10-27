-- Vzdialenosť a čas cesty z Bratislavy k lokalite eventu (počíta Edge Function `route`).
-- Nové stĺpce na `events` dedia existujúce RLS politiky tabuľky (čítanie schválení, zápis admin).
alter table public.events
  add column if not exists route_km numeric,
  add column if not exists route_min integer,
  add column if not exists route_for text;

comment on column public.events.route_for is 'Text lokality, pre ktorý sa trasa vypočítala (ak sa lokalita zmení, trasa sa prepočíta).';
