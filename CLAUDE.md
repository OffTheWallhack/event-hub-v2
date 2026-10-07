# Event Hub v2 — pokyny pre Claude Code

Interná appka pre Event Car Drivera (Red Bull). Celý spec je v `SPEC.md`, čítaj ho pred každou úlohou.
Používateľ (Robert) píše po slovensky, krátko. Odpovedaj po slovensky, jednoducho, bez zbytočného žargónu.

## Stack
- Vite + React 18 + TypeScript + TanStack Router (SPA, routy v `src/router.tsx`), Tailwind v4
- Všetka serverová logika (ICS sync, Google Drive, exporty, odkaz pre vodiča) = **Supabase Edge Functions** v `supabase/functions/`. Žiadny vlastný server.
- Hosting: Cloudflare Workers (statické assets z `dist/`, nastavenie v `wrangler.jsonc`, SPA fallback), adresa https://event-hub-v2.rdurica1995.workers.dev, nasadzuje sa automaticky z `main`
- Verejné hodnoty (URL + publishable kľúč) sú v `src/lib/supabase.ts`, tajné nikdy
- Supabase projekt `event-hub-v2`, ref `znsrokpaoczljisaoulu`, región eu-central-1, plán Free
- Prihlasovanie: Supabase Auth, len Google provider (už nastavený)
- Súbory: Google Drive cez Google Apps Script (Web app „Execute as Me“ v Robertovom účte; OAuth app v Google Cloud sa nepublikuje, ostáva Testing len pre prihlasovanie)

## Databáza
- Schéma už existuje a dáta zo starej appky sú prenesené (322 eventov atď.). **Nevytváraj tabuľky nanovo a nemaž dáta.**
- Migrácie sú v `supabase/migrations/`. Každá zmena schémy = nová migrácia s RLS v tom istom súbore.
- Roly v `profiles.role`: `pending | driver | admin`. Funkcie `is_admin()` a `is_approved()` použi v RLS.
- `rdurica1995@gmail.com` sa pri prvom prihlásení stane adminom automaticky (trigger `handle_new_user`).
- Financie (`expenses`, `driver_payouts`), `briefing_tokens`, `app_settings` = len admin.
- Kartóny: stav sa **počíta** z `carton_movements` (view `carton_stock`, len riadky `counts_in_stock = true`). Nikdy neukladaj stav ručne.
- `events` polia z Basecampu (`ical_uid, title, start_date, end_date, basecamp_notes, basecamp_url`) mení len ICS sync.
- Event zmiznutý z ICS → `status='cancelled'` (aj keď bol `done`, Basecamp rozhoduje), `deleted_from_basecamp=true`. Nikdy nemaž. Keď sa vráti, ide na `planned`.
- Po zmene schémy spusti Supabase security advisors.

## Pravidlá
- Žiadne heslá, kľúče, client secrets ani ICS odkaz v kóde, komentároch ani v md súboroch. Len `.env` / Cloudflare secrets. `.env*` je v `.gitignore`.
- Service role kľúč len na serveri, nikdy v prehliadači.
- UI po slovensky, mobile-first (používa sa hlavne na iPhone).
- Rob jeden krok z `SPEC.md` kapitoly 10 naraz. Na konci kroku: over, že `npm run build` prechádza, commitni s krátkou správou a v 3 vetách napíš, čo je hotové a čo má Robert vyskúšať.
- Najprv funkčný základ, žiadne extra featury navyše.
- Keď si nie si istý biznis pravidlom, opýtaj sa, nehádaj.

## Stav (október 2026)
- [x] Supabase projekt, schéma, RLS, migrácia dát
- [x] Google OAuth nastavený v Supabase
- [x] Krok 1: projekt + prihlasovanie cez Google + roly + schvaľovanie používateľov (Nastavenia)
- [x] Krok 3: ICS sync (Edge Function `ics-sync` + pg_cron každých 15 min, tajomstvo pre cron v `app_settings.sync_cron_secret`) + kalendár + stránka eventu
- [x] Krok 4: Kartóny + príchute (stránka /kartony, pohyby aj z eventu, inventúra = riadky `adjustment`; 5. 10. 2026 nastavený štartový stav Zero 1, ostatné 0)
- [x] Krok 5: Technika + sady (stránka /technika, technika ostáva po skupinách s počtom kusov – rozhodnutie Roberta; sady Zubor a Sugga; auto na evente pridá sadu)
- [x] Krok 6: Financie (/financie, výdavky + výplaty, súhrn na dashboarde; vodiči a výplaty na evente) + Edge Function `drive` (cez Google Apps Script v Robertovom účte – Web app URL a tajný kľúč v `private_kv` = len service role; priečinok Event Hub / Účty / YYYY-MM; kód skriptu sa zobrazí v Nastaveniach)
- [~] Krok 7: Exporty (stránka /export, generuje sa v prehliadači cez exceljs, samostatné súbory). Hotové: Event Car (hárky EVENT CAR/SUPPORT/ADHOC) a FINANCE. Ostáva: TECHNIKA, DRIVERS, PRODUCT
- [ ] Presun súborov (fotky, bločky, obrázky) zo starej appky
