# Event Hub v2

Interná appka pre Event Car Drivera. Spec: `SPEC.md`, pravidlá pre Claude Code: `CLAUDE.md`.

## Spustenie lokálne
```bash
npm install
npm run dev   # http://localhost:3000
```

## Nasadenie (Cloudflare Pages)
- Build command: `npm run build`
- Output directory: `dist`
- Supabase URL a publishable kľúč sú v `src/lib/supabase.ts` (verejné hodnoty), tajné kľúče nikdy nie.
