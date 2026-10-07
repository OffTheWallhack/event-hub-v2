// Jednorazové kopírovanie súborov zo starej appky do verejného priečinka `media`.
// Volá admin (JWT) alebo databáza (hlavička x-cron-secret). Body: { items: [{ url, dest }] }
// url musí byť https; dest je cesta v priečinku media (napr. vehicle-photos/builtin/zubor.png).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function authorized(req: Request): Promise<boolean> {
  const secret = req.headers.get('x-cron-secret')
  if (secret) {
    const { data } = await admin.from('app_settings').select('value').eq('key', 'sync_cron_secret').maybeSingle()
    return !!data?.value && data.value === secret
  }
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data: u } = await admin.auth.getUser(token)
  if (!u.user) return false
  const { data: p } = await admin.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
  return p?.role === 'admin'
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Len POST' }, 405)
  if (!(await authorized(req))) return json({ error: 'Nemáš oprávnenie' }, 401)
  const { items } = await req.json().catch(() => ({ items: [] }))
  if (!Array.isArray(items) || items.length === 0 || items.length > 60) return json({ error: 'Pošli 1 až 60 položiek.' }, 400)

  const results = []
  for (const it of items) {
    const url = String(it?.url ?? '')
    const dest = String(it?.dest ?? '')
    try {
      if (!/^https:\/\//.test(url)) throw new Error('url musí byť https')
      if (!/^[\w./-]+$/.test(dest) || dest.includes('..')) throw new Error('neplatná cieľová cesta')
      const ext = dest.split('.').pop()?.toLowerCase() ?? ''
      if (!MIME[ext]) throw new Error('povolené sú len obrázky')
      const res = await fetch(url)
      if (!res.ok) throw new Error(`zdroj vrátil ${res.status}`)
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.length > 10 * 1024 * 1024) throw new Error('súbor je väčší ako 10 MB')
      const { error } = await admin.storage.from('media').upload(dest, bytes, { contentType: MIME[ext], upsert: true, cacheControl: '31536000' })
      if (error) throw error
      results.push({ dest, ok: true, size: bytes.length })
    } catch (e) {
      results.push({ dest, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return json({ results })
})
