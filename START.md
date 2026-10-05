# Štart

Krok 1 (projekt, prihlasovanie cez Google, roly, schvaľovanie) je hotový v tomto repe.

## 1. Nahraj do GitHubu (raz)
V priečinku, kde si rozbalil zip:
```bash
git init
git branch -M main
git remote add origin https://github.com/OffTheWallhack/event-hub-v2.git
git add .
git commit -m "Krok 1: projekt, Google prihlasovanie, roly"
git push -u origin main
```

## 2. Supabase: povoľ návratové adresy (raz)
Supabase → event-hub-v2 → Authentication → URL Configuration → Redirect URLs, pridaj:
- `http://localhost:3000/**`
- neskôr aj adresu z Cloudflare (napr. `https://event-hub-v2.pages.dev/**`)

## 3. Vyskúšaj lokálne
```bash
npm install
npm run dev
```
Otvor http://localhost:3000 → Prihlásiť sa cez Google. Mal by si byť admin a vidieť Nastavenia.

## 4. Cloudflare Pages (raz)
dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → `event-hub-v2`
- Framework preset: None, Build command: `npm run build`, Output: `dist`
Po nasadení pridaj adresu do Supabase Redirect URLs (bod 2).

## 5. Ďalej v Claude Code
```bash
claude mcp add --transport http supabase "https://mcp.supabase.com/mcp?project_ref=znsrokpaoczljisaoulu"
```
Prompt: „Prečítaj CLAUDE.md a SPEC.md. Urob krok 3 z kapitoly 10.“
