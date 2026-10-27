// Zoznam zmien pre stránku Info (najnovšie hore). Pri každej väčšej zmene sem pribudne riadok a zvýši sa verzia v package.json.

export type ChangeEntry = { version: string; date: string; title: string; items: string[] }

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.10.0',
    date: '27. 10. 2026',
    title: '3D garáž so Zuborom a Suggou',
    items: [
      'Prihlásenie a úvodná obrazovka: Zubor a Sugga zaparkované v tmavej zadymenej garáži, svetlo na predok a logo',
      'Nová stránka Showroom (Viac → Showroom): garáž sa dá otáčať prstom a približovať',
      'Vzadu bliká a iskrí pokazená dióda, vpravo svieti miesto pre chladničku (model príde neskôr)',
      'Modely zmenšené z 33 MB na 1,3 MB (meshopt + webp), 3D sa sťahuje až keď treba',
    ],
  },
  {
    version: '1.9.1',
    date: '27. 10. 2026',
    title: 'Export Finance presne ako účtovná tabuľka',
    items: [
      'Hárok „SEP 2026“: Spolu hore (zelená suma), Scany účtov, stĺpce Dátum, Typ dokladu, Suma, Event, DPT, Popis, Kontrola, Bloček',
      'Dátum ako 5.9.2026 alebo 19.-20.9.2026, typ dokladu malými písmenami (blok, ucet, taxi, brigadnik), DPT: EC / CLT / SED',
      'Brigádnici: suma s 15 %, v stĺpci Bloček „brigadnik / poznámka z výplaty“',
    ],
  },
  {
    version: '1.9.0',
    date: '27. 10. 2026',
    title: 'Čo chýba na evente + cesta z Bratislavy',
    items: [
      'Na evente (admin) pás „Čo chýba“ (vodič, výplata, lokalita, technika, kartóny) alebo zelené „Event je kompletný“',
      'Dashboard → Treba doriešiť: zoznam neúplných eventov',
      'Pri lokalite sa sama spočíta vzdialenosť a čas cesty autom z Bratislavy (Edge Function route)',
    ],
  },
  {
    version: '1.8.1',
    date: '24. 10. 2026',
    title: 'Zoznam vodičov v Nastaveniach',
    items: [
      'Nastavenia → Vodiči: vodiča vypneš (Skrytý) a nebude sa ponúkať na výber na eventoch, v databáze ostáva',
      'Na evente, kde už vodič je, ostane viditeľný aj keď je skrytý',
    ],
  },
  {
    version: '1.8.0',
    date: '24. 10. 2026',
    title: 'Stránka eventu naživo a posuvník písma',
    items: [
      'Vzhľad: posuvník veľkosti písma (12–18 px, štandard je teraz menší, 15 px) – menšie písmo zmenší aj bloky a tlačidlá',
      'Stránka eventu je jedna stránka v poradí: Vozidlo a vodič, Logistika, Technika, Kartóny, Náklady, Pošli vodičovi, Report',
      'Žiadne Upraviť ani Hotovo: čo prepíšeš alebo ťukneš, uloží sa samo (hore sa ukáže Ukladám… / Uložené)',
      'Lokalita: odkaz na mapu sa nájde sám podľa napísaného miesta (Google Maps, prvý výsledok); vlastný odkaz je nepovinný',
      'Kartóny: pri každej príchuti − / +, sklad sa prepočíta sám',
      'Technika: pri každom kuse − / +, ďalšia technika cez Pridať techniku',
      'Hlavička: pred dátumom je dnes / zajtra / pozajtra / o 3 dni / o 2 mesiace (a včera, pred 3 dňami…), dlhý text z Basecampu má Zobraziť viac, preč je riadok o synchronizácii',
    ],
  },
  {
    version: '1.7.0',
    date: '24. 10. 2026',
    title: 'Dve témy a pevné písma',
    items: [
      'Zmazaných všetkých 30 tém, posuvníky, animácie pozadia a CRT efekty – ostala jedna svetlá a jedna tmavá téma (Viac → Vzhľad)',
      'Tri písma priamo v appke (nesťahujú sa z internetu): Inter na text, Barlow Condensed na nadpisy a veľké čísla, JetBrains Mono na kódy a štítky',
      'Pevné rozmery: veľkosť písma ani zaoblenia sa už nedajú meniť, iPhone text sám nezväčšuje, stránka neposkakuje pri zobrazení posuvníka',
      'Téma sa nastaví ešte pred vykreslením, takže pri otváraní appky nebliká zlé pozadie',
    ],
  },
  {
    version: '1.6.0',
    date: '16. 10. 2026',
    title: 'Nový vzhľad celej appky a ikona',
    items: [
      'Spodné menu ako v iPhone appkách (Kalendár, To-Do, Kartóny, Technika, Viac), na počítači bočný panel',
      'Jednotné tlačidlá, polia, prepínače a karty v celej appke – všetko berie farby z témy',
      'Písmo Inter (Barlow ostáva na výber vo Vzhľade)',
      'Vzhľad má vlastnú stránku (Viac → Vzhľad), náhľady tém ukazujú farby, písmo aj sklo',
      'Opravy tém: čiary v zoznamoch, čitateľný text na akcente, rozbaľovacie zoznamy v tmavých témach, Game Boy, Liquid glass',
      'Stránka eventu: logistika hore, náklady nižšie, jedno tlačidlo Upraviť',
      'Technika ako prehľadný zoznam s náhľadom, To-Do s prepínačom Otvorené / Hotové',
      'Polia vo formulároch už na iPhone nepribližujú stránku pri písaní',
      'Ikona appky na plochu iPhonu: Event / Hub / v2 so Zuborom na bielom pozadí',
    ],
  },
  {
    version: '1.5.0',
    date: '16. 10. 2026',
    title: 'Tri nové témy',
    items: [
      'Paddock: tmavé karbónové pozadie, ostré rohy, žltý akcent',
      'Liquid glass: priehľadné sklenené karty a farebné svetlo na pozadí',
      'PS2 Memory Card: farebné svetlá v rohoch, lesklá podlaha a pomaly sa otáčajúce kocky (nový efekt pozadia „PS2“)',
      'Text na farebných tlačidlách sa volí podľa skutočného kontrastu – na žltej či zelenej je teraz čierny a čitateľný',
    ],
  },
  {
    version: '1.4.1',
    date: '8. 10. 2026',
    title: 'Čistejšie horné menu',
    items: ['Témy a vzhľad sú schované v Nastaveniach (karta „Vzhľad a témy“), v hornej lište ostáva len verzia a Odhlásiť'],
  },
  {
    version: '1.4.0',
    date: '8. 10. 2026',
    title: 'Zálohy na Drive a kalendár s úlohami',
    items: [
      'Záloha všetkých tabuliek (JSON) na Google Drive každý deň o 0:00 a 12:00, tlačidlo „Zálohovať teraz“ v Nastaveniach',
      'To-Do: odkaz do Kalendára iPhonu – úlohy s termínom alebo pripomienkou sa objavia v kalendári s upozornením',
    ],
  },
  {
    version: '1.3.0',
    date: '8. 10. 2026',
    title: 'Viac tém a písma k témam',
    items: [
      'Nové témy: Windows XP, Windows 95, Commodore 64, Cyberpunk, Vaporwave, Západ slnka, Nord, Papier',
      'Každá téma má vlastné písmo (PSP Open Sans, Wii okrúhle, Terminal VT323, Game Boy pixel, Synthwave techno…)',
      'Písmo sa dá vybrať ručne (13 druhov, každé ukázané svojím písmom) a zaškrtnúť „Nechať moje písmo pri zmene témy“',
    ],
  },
  {
    version: '1.2.0',
    date: '8. 10. 2026',
    title: 'Vzhľad: nové témy a posuvníky na všetko',
    items: [
      'Nové témy: PSP (vlny), Wii, Terminal (matrix), Amber CRT, Game Boy, Synthwave, Vesmír',
      '🎨 teraz otvorí panel: odtieň, sýtosť, jas, kontrast, farby, priehľadnosť a zaoblenie kariet, písmo, žiara, CRT riadky',
      'Animácie pozadia: aura, vlny, mriežka, matrix, hviezdy, bubliny – s rýchlosťou, silou a vlastnými farbami',
      'Vlastné nastavenie sa dá uložiť ako „Moja“; animácie už nevypína systémové „znížiť pohyb“',
    ],
  },
  {
    version: '1.1.0',
    date: '7. 10. 2026',
    title: 'Témy, Technika ako v starej appke, výber mesiacov',
    items: [
      '14 farebných tém (biela, piesková, jantárová, čierna, ohnivá, neón…) a animované pozadie „aura“ – tlačidlo 🎨 hore',
      'Technika: veľká fotka vpravo, počty voľné / požičané / pokazené, žltý box „Požičané: komu“, záložky Audio / DJ / Cooler / Rekvizity / Iné',
      'Väčšie menu, kompaktnejšia mesačná štatistika',
      'Mini kalendár na evente: zvislé čiarky (1 čiarka = 1 event), servis má inú farbu',
      'Garáž len Zubor, Sugga a Garáž; fotky áut len tie, ktoré nahráš sám',
      'Export: mesiace sa vyklikávajú, záložky rokov 2024 / 2025 / 2026, viac mesiacov naraz',
    ],
  },
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
