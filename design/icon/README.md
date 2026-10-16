# Ikona appky (EHv2 + Zubor)

- `icon.html` – návrh ikony (1024×1024). Varianty: `v1` tmavomodrá so slnkom (používaná), `v2` červená, `v3` strieborná.
- `zubor_crop.png` – Zubor vystrihnutý z fotky (bez pozadia).
- Nové vykreslenie: `node render.cjs` (Playwright) → `icon-v1.png` … potom zmenšiť do `public/` (180 apple-touch-icon, 192, 512, 32 favicon).
