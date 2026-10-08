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
- [x] Krok 7: Exporty (stránka /export, generuje sa v prehliadači cez exceljs, samostatné súbory): Event Car (+ hárky TECHNIKA), TECHNIKA, FINANCE, DRIVERS, PRODUCT
- [x] Krok 8: Odkaz a PDF pre externého vodiča (verejná stránka /brief/<token>, Edge Function `brief` vracia len bezpečné polia; z poznámok z Basecampu sa filtrujú riadky so € a interné odkazy; PDF = tlač stránky; odkaz vytvára admin na evente, platí do konca eventu + 3 dni, aspoň 1 deň)
- [x] Krok 9: To-Do (/todo, kompaktný zoznam, rozsahy general/garage/vehicle) + Garáž (/garaz: autá, poznámky k autu, úlohy, servisy) + pripomienky v appke (`todos.remind_at`, banner len pre admina, beží pri otvorenej appke). Telegram/Grok bot a kalendárový odkaz do iPhonu zatiaľ nie sú. Pri migrácii sa stratila väzba `todos.vehicle_id` – 7. 10. 2026 obnovená zo starej appky
- [x] Krok 10: Report po evente (komponent EventReport na stránke eventu, len admin: kontrola kartónov/techniky, vrátená/pokazená/nevrátená technika sa zapíše aj do `equipment.status_event_id`, diváci, hviezdičky, text, hral som ako DJ, uzavrieť event) + dashboard panel Dnes / Najbližší event / Treba doriešiť (skončené neuzavreté eventy, technika požičaná alebo nevrátená)
- [x] Presun súborov: fotky techniky, príchutí a áut zo starej appky sú v bucket `media` (bločky sú na Drive)
- [x] Vzhľad: panel 🎨 (src/lib/theme.ts, fx.ts, ThemePicker.tsx) – 27 predvolieb (PSP, Wii, Terminal…), posuvníky, animácie pozadia, písma; ukladá sa v prehliadači
- [x] Info stránka (/info): verzia, stav služieb, zoznam zmien (src/lib/changelog.ts – pri každej väčšej zmene pridať riadok a zvýšiť verziu v package.json)
- [x] Zálohy: Edge Function `backup` (cron `backup-hourly` každú hodinu, zálohuje o 0:00 a 12:00 slovenského času; JSON všetkých tabuliek okrem private_kv → Drive: Event Hub / Zálohy / YYYY-MM; stav + „Zálohovať teraz“ v Nastaveniach)
- [x] Kalendár s úlohami do iPhonu: Edge Function `todo-ics` (tajný token v `private_kv.todo_ics_token`, odkaz vidí len admin na stránke To-Do)
