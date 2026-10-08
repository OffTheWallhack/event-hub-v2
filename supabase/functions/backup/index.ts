// Záloha všetkých tabuliek (JSON) do Google Drive (Event Hub / Zálohy / YYYY-MM).
// Spúšťa: cron každú hodinu (hlavička x-cron-secret) – zálohuje o 0:00 a 12:00 slovenského času
// (ak sa nepodarí, skúša ďalšie 2 hodiny), alebo admin tlačidlom v Nastaveniach.
// Drive sa volá cez ten istý Google Apps Script ako pri dokladoch (private_kv: drive_script_url, drive_script_secret).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

const TZ = 'Europe/Bratislava'
const ROOT = ['Event Hub', 'Zálohy']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

async function kvGet(key: string) {
  const { data } = await admin.from('private_kv').select('value').eq('key', key).maybeSingle()
  return (data?.value as string | undefined) ?? null
}
async function kvSet(key: string, value: string) {
  const { error } = await admin.from('private_kv').upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw error
}

async function who(req: Request): Promise<'cron' | 'admin' | null> {
  const cron = req.headers.get('x-cron-secret')
  if (cron) {
    const { data } = await admin.from('app_settings').select('value').eq('key', 'sync_cron_secret').maybeSingle()
    return data?.value && data.value === cron ? 'cron' : null
  }
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: u } = await admin.auth.getUser(token)
  if (!u.user) return null
  const { data: p } = await admin.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
  return p?.role === 'admin' ? 'admin' : null
}

function parts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]))
  return { day: `${o.year}-${o.month}-${o.day}`, month: `${o.year}-${o.month}`, hour: Number(o.hour), hm: `${o.hour}-${o.minute}` }
}

type Last = { at: string; ok: boolean; name?: string; url?: string; tables?: number; rows?: number; kb?: number; error?: string; slot?: string }

async function runBackup(slot: string | null): Promise<Last> {
  const now = new Date()
  const p = parts(now)
  try {
    const scriptUrl = await kvGet('drive_script_url')
    const secret = await kvGet('drive_script_secret')
    if (!scriptUrl || !secret) throw new Error('Google Drive nie je prepojený (Nastavenia → Google Drive).')

    const { data, error } = await admin.rpc('backup_dump')
    if (error) throw new Error(error.message)
    const dump = data as Record<string, unknown[]>
    const tables = Object.keys(dump).length
    const rows = Object.values(dump).reduce((s, t) => s + t.length, 0)
    const body = JSON.stringify({ created_at: now.toISOString(), timezone: TZ, tables: Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length])), data: dump })
    const bytes = new TextEncoder().encode(body)
    const name = `zaloha_${p.day}_${p.hm}.json`

    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, folders: [...ROOT, p.month], name, mime: 'application/json', data: encodeBase64(bytes) }),
    })
    const text = await res.text()
    let out: Record<string, unknown>
    try { out = JSON.parse(text) } catch { throw new Error('Skript na Drive neodpovedá správne.') }
    if (out.error) throw new Error(String(out.error))

    const last: Last = { at: now.toISOString(), ok: true, name, url: String(out.url ?? ''), tables, rows, kb: Math.round(bytes.length / 1024), slot: slot ?? undefined }
    await kvSet('last_backup', JSON.stringify(last))
    if (slot) await kvSet('last_backup_slot', slot)
    return last
  } catch (e) {
    const last: Last = { at: now.toISOString(), ok: false, error: e instanceof Error ? e.message : String(e), slot: slot ?? undefined }
    await kvSet('last_backup', JSON.stringify(last))
    return last
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Len POST' }, 405)
  try {
    const role = await who(req)
    if (!role) return json({ error: 'Nemáš oprávnenie' }, 401)
    const body = await req.json().catch(() => ({}))

    if (role === 'admin' && body.action === 'status') {
      const v = await kvGet('last_backup')
      return json({ last: v ? JSON.parse(v) : null })
    }
    if (role === 'admin' && body.action === 'run') {
      return json({ last: await runBackup(null) })
    }
    if (role === 'cron') {
      // 0:00 a 12:00 (a nasledujúce 2 hodiny, ak zlyhalo)
      const p = parts(new Date())
      const base = p.hour < 3 ? 0 : p.hour >= 12 && p.hour < 15 ? 12 : null
      if (base === null) return json({ skipped: 'nie je čas zálohy' })
      const slot = `${p.day}T${String(base).padStart(2, '0')}`
      if ((await kvGet('last_backup_slot')) === slot) return json({ skipped: 'už zálohované', slot })
      return json({ last: await runBackup(slot) })
    }
    return json({ error: 'Neznáma akcia' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
