// Zoznam zmien pre stránku Info (najnovšie hore). Pri každej väčšej zmene sem pribudne riadok a zvýši sa verzia v package.json.

export type ChangeEntry = { version: string; date: string; title: string; items: string[] }

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.0.0',
    date: '7. 10. 2026',
    title: 'Dokončenie: obrázky, Info, nové rozloženie',
    items: [
      'Menu s ikonami je celé viditeľné naraz, mesiace a listovanie medzi eventmi sú v spodnej lište',
      'Spodná lišta eventu: ‹ › na predošlý / ďalší event a mini kalendár s miniatúrami eventov',
      'Obrázky: logá príchutí v Kartónoch, fotky techniky a áut, nahrávanie pre admina (priečinok media)',
      'Export: náhľad hárkov s hlavičkami pred stiahnutím; Financie sú farebnejšie',
      'Suby: Sub 15" a Sub 18" ako dve položky po 2 kusoch, na eventoch vždy 2',
      'Stránka Info: verzia, stav služieb, zoznam zmien',
    ],
  },
  {
    version: '0.9.0',
    date: '7. 10. 2026',
    title: 'Report po evente a prehľad „Dnes“',
    items: [
      'Report po evente: kontrola kartónov a techniky, vrátená / pokazená / nevrátená technika, diváci, hviezdičky, text',
      'Dashboard: Dnes, Najbližší event, Treba doriešiť (neuzavreté eventy, požičaná technika)',
      'Oprava menu: čitateľný text aktívnej položky',
    ],
  },
  {
    version: '0.8.0',
    date: '7. 10. 2026',
    title: 'To-Do, Garáž, pripomienky',
    items: [
      'To-Do: kompaktný zoznam podľa termínu, rozsahy Všeobecné / Garáž / Auto',
      'Garáž: autá, poznámky k autu, úlohy, servisy',
      'Pripomienky v appke (len pri otvorenej appke)',
      'Obnovená väzba úloh na autá, ktorá sa stratila pri migrácii',
    ],
  },
  {
    version: '0.7.0',
    date: '7. 10. 2026',
    title: 'Exporty a odkaz pre vodiča',
    items: [
      'Excel exporty: Event Car (+ TECHNIKA), TECHNIKA, FINANCE, DRIVERS, PRODUCT',
      'Verejný odkaz a PDF pre externého vodiča, bez financií a bez interných poznámok o sumách',
    ],
  },
  {
    version: '0.6.0',
    date: '6. 10. 2026',
    title: 'Financie a Google Drive',
    items: [
      'Výdavky, výplaty vodičov s 15 % daňou, mesačný súhrn',
      'Bločky do Google Drive cez Apps Script, náhľad so zväčšovaním, blokujúce nahrávanie s priebehom',
    ],
  },
  {
    version: '0.5.0',
    date: '6. 10. 2026',
    title: 'Technika a sady',
    items: ['Technika po skupinách s počtom kusov, rýchla zmena stavu', 'Sady Zubor a Sugga, výber auta pridá sadu', 'Mriežka s ikonkami po kategóriách na evente'],
  },
  {
    version: '0.4.0',
    date: '5. 10. 2026',
    title: 'Kartóny a príchute',
    items: ['Stav skladu z pohybov, závoz, výdaj, inventúra, história, štatistiky, správa príchutí', 'Sync ruší aj hotové eventy, ktoré zmiznú z Basecampu'],
  },
  {
    version: '0.3.0',
    date: '5. 10. 2026',
    title: 'Basecamp sync, kalendár, stránka eventu',
    items: ['Automatická synchronizácia každých 15 minút + tlačidlo', 'Mesačný kalendár so štatistikami', 'Stránka eventu s blokom z Basecampu a úpravou logistiky'],
  },
  {
    version: '0.1.0',
    date: '5. 10. 2026',
    title: 'Základ',
    items: ['Prihlasovanie cez Google, role, schvaľovanie používateľov', 'Nasadenie na Cloudflare, databáza v Supabase'],
  },
]

/** Čo ešte nie je hotové (pre „čo sa nepridalo“). */
export const NOT_YET: string[] = [
  'Presun fotiek z starej appky (príchute, technika, autá) – rozbieha sa',
  'Kalendárový odkaz do iPhonu (úlohy s dátumom v kalendári a jeho widgete)',
  'Pripomienky cez Telegram (teraz len pri otvorenej appke)',
  'Mind map zobrazenie úloh',
  'Obojsmerná synchronizácia s Notionom – zámerne nie',
]
