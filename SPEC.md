# Event Hub v2 — SPEC

> Stav: schéma a migrácia dát sú hotové (krok 2). Kóduje sa v Claude Code, pravidlá v CLAUDE.md.

Interná appka pre Event Car Drivera (Red Bull). Mobile-first, po slovensky.
Zdroj pravdy: **Basecamp (eventy cez ICS)** + **Supabase (všetko ostatné)**.
Google Sheets/Excel sú len **exporty** v dnešných formátoch.

## 1. Stack
- Vite + React + TypeScript + TanStack Router (SPA), Tailwind
- Serverová logika ako Supabase Edge Functions (ICS sync, Drive, exporty, odkaz pre vodiča)
- Hosting: Cloudflare Pages, adresa `*.pages.dev`, bez vlastnej domény
- Databáza + prihlasovanie: Supabase projekt `event-hub-v2` (Free, región eu-central-1)
- Súbory: Google Drive (osobný Gmail účet, OAuth refresh token — nie service account)
- Tajomstvá len v env/secrets. Nikdy nie v kóde, komentároch ani v dokumentoch.

## 2. Roly a prístup
- Prihlásenie **cez Google**. Nový používateľ sa po prvom prihlásení uloží ako `pending`.
- Admin (Robert) schváli používateľa: `admin` (všetko) alebo `driver` (len čítanie).
- `driver`: vidí kalendár, eventy, techniku, kartóny. **Nevidí financie ani výplaty.**
- Len `admin` upravuje: príchute, techniku, financie, výplaty, nastavenia.
- RLS zapnuté na každej tabuľke. Financie (`expenses`, `driver_payouts`) čitateľné a zapisovateľné len adminom.
- Externý vodič: verejný odkaz bez prihlásenia (viď 6.), bez financií.

## 3. Dátový model (návrh)
Všetky tabuľky majú `id uuid`, `created_at`, `updated_at`.

**profiles** — `user_id` (auth), `email`, `name`, `role` (`pending|driver|admin`)

**events**
- z Basecampu (len sync ich prepisuje): `ical_uid` (unique), `title`, `start_date`, `end_date`, `basecamp_notes`, `basecamp_url`
- `status`: `planned|done|cancelled` (event, ktorý zmizne z ICS, dostane `cancelled` + `deleted_from_basecamp=true`, nikdy sa nemaže)
- `event_type`: `event_car|support|adhoc|servis` (jedno, predvolené `event_car`)
- `departments` text[]: `ec|culture|sport|onpremise` (kombinácie povolené)
- `location`, `location_url`, `spectators`, `planned_arrival` (čas), `contact`
- `description` (stručný popis práce pre šéfa a nacenenie), `report`, `rating` (1–5)
- `photos_folder_url`, `social_url`, `no_expenses`, `played_as_dj`
- trvanie v dňoch sa **počíta**, neukladá sa

**vehicles** (Zubor, Sugga, Caddy, Avis, Other…), **event_vehicles** (event ↔ auto, viac naraz, jedno primárne)

**drivers** (meno, aktívny), **event_drivers** (event ↔ vodič, poradie, primárny)
**driver_payouts** — `event_id`, `driver_id`, `amount` (suma bez dane), `paid`, `paid_at`, `note`
- Pre Roberta sa výplata nezadáva. Pre iného vodiča appka vyzve na sumu.
- Daň 15 % sa **pripočíta navrch** (100 € → náklad 115 €). Zvyčajne za celý event.

**equipment** — katalóg techniky, **každý kus samostatný riadok** (každá chladnička zvlášť; repráky a CDJ v pároch netreba rozlišovať, stačí `quantity`)
- `name`, `category` (`coolers|audio|branding|others`), `quantity`, `photo_path`
- `status`: `ok|broken|lost|rented_out|borrowed|in_rent`, `status_note`, `held_by` (komu požičané), `status_event_id`
- Pridať novú techniku môže len admin, bez zásahu do kódu.
**equipment_sets** + **equipment_set_items** — sady (napr. Zubor = Mix + CDJ zo Zubra + 1× mic; Sugga = Konzola zo Suggy + 1× mic). Výber auta na evente automaticky pridá sadu.
**event_equipment** — `event_id`, `equipment_id`, `quantity`, `returned_confirmed`, `returned_at`, `issue` (`none|broken|not_returned`) → z toho sa počíta, koľkokrát a koľko dní bola technika požičaná.

**flavors** — `name`, `color_bg/text/border`, `photo_path`, `sort_order`, `active` (pridáva admin)
**carton_movements** — **log pohybov, stav sa vždy dopočíta, nikdy sa neukladá**
- `flavor_id`, `cartons` (celé číslo so znamienkom), `type` (`delivery|event|returned|opened_garage|damaged|adjustment`), `event_id` (voliteľné), `recipient`, `note`, `occurred_at`
- Jeden event = viac riadkov (10× ED, 1× Peach, 1× Zero). Počíta sa **len v kartónoch**.
- View `carton_stock` = súčet po príchutiach. Štatistiky: prišlo / spotreba / % spotreby podľa oddelenia.

**expenses**
- `date`, `doc_type` (`blok|ucet|faktura|taxi|brigadnik|screenshot|ziadny`), `amount`, `description` (veľmi krátky), `event_id`, `drive_file_url`, `drive_file_name`, `control` (stĺpec Kontrola)
- Brigádnici sa do exportu pridávajú z `driver_payouts` ako riadky typu `brigadnik`.

**briefing_tokens** — `event_id`, `token` (náhodný), `expires_at` = koniec eventu + 3 dni, `revoked`

**todos** — `scope` (`general|vehicle|garage`), `vehicle_id`, `text`, `status` (`open|in_progress|done`), `due_date`, `remind_at`
**vehicle_services** — servisy a poznámky k autám

**app_settings**, **sync_status** (posledný ICS sync, výsledok, chyba)

## 4. ICS sync
- Zdroj len ICS odkaz z Basecampu (v secrete `BASECAMP_ICAL_URL`, žiadne API).
- Beh: cron (každých ~15 min) + tlačidlo „Synchronizovať“.
- Párovanie podľa `ical_uid`. Zmena času/názvu/poznámok prepíše len Basecamp polia, všetko ostatné ostáva.
- Zmiznutý event → `cancelled`, nič sa nemaže.
- Import od `2026-01-01` (aj staršie z migrácie).

## 5. Obrazovky
1. **Dashboard** — mesačný kalendár (7×6), 0–6 eventov na deň, viacdňové eventy sa naťahujú. Farby: Event Car červená, Support oranžová, Adhoc modrá, Servis žltá. Mesačné štatistiky (tento vs. minulý mesiac: spolu, podľa typu, voľné vs. obsadené dni). Mesačný prehľad financií (vedľajšie náklady, brigádnici + 15 %, koľko pošle Red Bull). Bez zoznamov „teraz/budúce/minulé“, bez notifikácií, bez archívu hodnotení.
2. **Event** — hore: status, typ, Basecamp blok (jasne označený ako zdroj pravdy: názov, dátumy, trvanie, poznámky). Hneď pod ním **súčet nákladov a zoznam účtov** (bez scrollovania). Potom logistika (čas príchodu, kontakt, vozidlá, lokalita, vodiči + výplaty, kartóny po príchutiach, technika s automatickými sadami), fotky, tlačidlá **Pošli vodičovi** (živý odkaz alebo PDF) a **Report** (kontrola poznámok, kartónov a techniky; divákov; 1–5 hviezdičiek; text; označenie techniky ako nevrátená/pokazená s odkazom na event).
3. **Technika** — zoznam s obrázkami, rýchla zmena stavu (OK / pokazené / požičané / stratené / v prenájme + komu).
4. **Kartóny** — aktuálny stav po príchutiach, pridať závoz, odobrať bez eventu s poznámkou, história pohybov, štatistiky, správa príchutí (admin).
5. **Garáž** — autá + to-dos (general, auto, garáž) + servisy. To-dos majú status, dátum a pripomienku.
6. **Financie** — výdavky po mesiacoch, nahranie dokladu → výber eventu (najnovšie hore) → uloženie do Drive priečinka mesiaca.
7. **Export** — viď 7.
8. **Nastavenia** — používatelia (schvaľovanie), vodiči, vozidlá, príchute, sady techniky, Google Drive prepojenie.

## 6. Odkaz pre externého vodiča
Verejná stránka `/brief/<token>`, bez prihlásenia, platí do konca eventu + 3 dni. Obsahuje: názov, dátumy, popis z Basecampu, lokalitu (s odkazom na mapu), čas príchodu, kontakt, vozidlá, vodičov, techniku, kartóny, logistiku. **Nikdy financie.** Alternatíva: PDF s tým istým obsahom. Funkčný základ prenieseme zo starej appky (`brief.$token.tsx`, `event-briefing-pdf.ts`).

## 7. Exporty (mesiac alebo viac mesiacov)
Excel (.xlsx), v dnešných tvaroch, aby si ich Robert len prehodil do svojich sheetov. Vždy sa vyexportuje balík:
- **EVENT CAR / SUPPORT / ADHOC** — rovnaké stĺpce ako Event Car Driver tabuľka (Event Car: Dátum, Dátum koniec, Počet dní, Technika, Event Car, Názov, Driver, Lokalita, dpt, Spectators; Support: + Popis; Adhoc: Dátum, Vozidlo, Názov, Driver, Lokalita, dpt). Kódy dpt: `ONP` = onpremise, `CUL/CLT` = culture, `SPORT/SED` = sport, `EC` = event car.
- **FINANCE** (dôležité pre financie v Red Bulle) — jeden hárok na mesiac ako Vyúčtovanie: hlavička so súčtom a odkazom na scany, stĺpce Dátum, Typ dokladu, Suma, Event, DPT, Popis, Kontrola, Bloček. Brigádnik: popis `Meno - 80 EUR + 15%`, suma 92.00. Názov súboru bločku `YYYY-MM-DD_suma_obchod.ext`.
- **TECHNIKA** (dôležité pre šéfa) — **všetko**: koľko kusov bolo na ktorom evente, koľko dní, koľkokrát požičané, aj mesačný súhrn po type (mic, repro, RCF, sub, konzola…).
- **DRIVERS** — koľko peňazí ide ktorému vodičovi za mesiac (s daňou).
- **PRODUCT** — pohyby kartónov po príchutiach, stav, spotreba podľa oddelenia.

## 8. Google Drive
- Fotky: priečinok `Eventy/<YYYY-MM>/<DD.MM. Názov eventu>`, appka ho vytvorí sama a zapíše odkaz.
- Účty: existujúci priečinok s mesačnými podpriečinkami. Súbory sa nahrávajú z appky, názov podľa vzoru vyššie.
- Dodatočne sa dajú exporty a dáta nahrať aj do Basecampu (ručne, nízka priorita).

## 9. Migrácia zo starej appky (Lovable Cloud → nový Supabase)
Prenáša sa **všetko**, vrátane väzieb: events (322), drivers (17), event_drivers (238), driver_payouts (40), expenses (80), equipment (38) + event_equipment (523), vehicles (7) + event_vehicles (249), flavors (13), event_reviews (81 → rating/report na evente), event_briefing_tokens (146), event_photos (51), todos (15 + 19), settings.
- **Kartóny:** `can_movements` (v plechovkách) ÷ 24 → `carton_movements`; `sampling` (214 záznamov, množstvo = kartóny) → `carton_movements`; `cc_cans` je prázdna.
- **CC panel sa maže** (`event_cc`, CC rola, CC kalendár, `cc.functions.ts`). Z `event_cc` sa neprenáša nič okrem prípadného hodnotenia, ak ho event nemá inde.
- Súbory (fotky eventov, bločky, fotky techniky a príchutí) sa presunú do Drive/Supabase Storage.
- Stará appka beží, kým nová nie je overená.

## 10. Poradie stavby
1. Projekt + prihlasovanie cez Google + roly + RLS ✅ hotové
2. Schéma DB + migrácia dát ✅ hotové
3. ICS sync + kalendár + stránka eventu
4. Kartóny + príchute
5. Technika + sady
6. Financie + nahrávanie dokladov do Drive
7. Exporty (FINANCE a Event Car ako prvé)
8. Odkaz/PDF pre vodiča
9. Garáž + to-dos + pripomienky (Telegram/Grok bot)
10. Report po evente, doladenie

## 11. Pravidlá pre kódenie (Claude Code)
- Pracuj po jednom kroku z kapitoly 10, po každom commit a krátky popis zmeny.
- Žiadne heslá, kľúče ani ICS odkazy v kóde. Len env.
- Každá nová tabuľka má RLS hneď v migrácii.
- Stav kartónov a technika sa počíta z pohybov, neukladá sa ručne.
- Texty v UI po slovensky, jednoducho.
- Najprv musí fungovať základ, žiadne zbytočné featury.

## 12. Otvorené veci
- Telegram bot na bločky: voliteľné, až po základe.
- Upgrade Supabase na Pro (kvôli uspávaniu Free projektu a zálohám) neskôr.
- Vlastná doména neskôr (kvôli prihlasovaniu a odkazom).
