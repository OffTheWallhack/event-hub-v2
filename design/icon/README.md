# Ikona appky (Event / Hub / v2 + Zubor)

- `icon.html` – návrh ikony 1024×1024: biele pozadie, text v troch riadkoch, Zubor vpravo dole. Rozloženie cez CSS premenné (`--fs` veľkosť písma, `--cw` šírka auta…).
- `render.cjs` – vykreslí varianty a/b/c (Playwright). Používa sa `a`.
- `zubor_crop.png` – Zubor vystrihnutý z fotky (bez pozadia).
- Exporty v `public/`: apple-touch-icon 180, icon-192, icon-512, favicon-32.
