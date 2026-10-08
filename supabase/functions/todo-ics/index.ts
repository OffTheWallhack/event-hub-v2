// Kalendárový odkaz s úlohami pre iPhone (Kalendár → Pridať odber kalendára).
// GET ?t=<tajný token>  → .ics s otvorenými úlohami, ktoré majú termín alebo pripomienku.
// POST (admin, JWT) { action: 'link' | 'rotate' } → vráti token (vytvorí, resp. vymení za nový).
// Token je v private_kv (todo_ics_token); odkaz vidí len admin v appke.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')

async function isAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data: u } = await admin.auth.getUser(token)
  if (!u.user) return false
  const { data: p } = await admin.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
  return p?.role === 'admin'
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
// riadky max 75 bajtov, pokračovanie začína medzerou
function fold(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = '' }
    cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const dateOnly = (s: string) => s.replace(/-/g, '')
function nextDay(s: string) {
  const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

async function feed(): Promise<string> {
  const { data: todos } = await admin
    .from('todos')
    .select('id, text, scope, vehicle_id, status, priority, due_date, remind_at, vehicles(name)')
    .neq('status', 'done')
    .or('due_date.not.is.null,remind_at.not.is.null')
  const now = new Date()
  const L: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Event Hub//To-Do//SK', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Event Hub – úlohy', 'X-WR-TIMEZONE:Europe/Bratislava',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M',
  ]
  for (const t of (todos ?? []) as unknown as { id: string; text: string; scope: string; status: string; priority: number; due_date: string | null; remind_at: string | null; vehicles: { name: string } | null }[]) {
    const where = t.vehicles?.name ?? (t.scope === 'garage' ? 'Garáž' : '')
    const title = `☐ ${where ? where + ': ' : ''}${t.text}`
    L.push('BEGIN:VEVENT', `UID:todo-${t.id}@event-hub`, `DTSTAMP:${stamp(now)}`)
    if (t.remind_at) {
      const s = new Date(t.remind_at)
      L.push(`DTSTART:${stamp(s)}`, `DTEND:${stamp(new Date(s.getTime() + 30 * 60000))}`)
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:PT0S', 'END:VALARM')
    } else {
      L.push(`DTSTART;VALUE=DATE:${dateOnly(t.due_date!)}`, `DTEND;VALUE=DATE:${dateOnly(nextDay(t.due_date!))}`)
      // pripomienka o 9:00 v ten deň
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER;RELATED=START:PT9H', 'END:VALARM')
    }
    L.push(`SUMMARY:${esc(title)}`)
    const desc = [t.status === 'in_progress' ? 'Rozrobené' : '', t.due_date && t.remind_at ? `Termín: ${t.due_date}` : ''].filter(Boolean).join(' · ')
    if (desc) L.push(`DESCRIPTION:${esc(desc)}`)
    L.push('TRANSP:TRANSPARENT', 'END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return L.map(fold).join('\r\n') + '\r\n'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method === 'GET') {
      const t = new URL(req.url).searchParams.get('t') ?? ''
      const real = await kvGet('todo_ics_token')
      if (!real || t.length !== real.length || t !== real) return new Response('Neplatný odkaz', { status: 404 })
      return new Response(await feed(), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache' } })
    }
    if (req.method !== 'POST') return json({ error: 'Nepodporované' }, 405)
    if (!(await isAdmin(req))) return json({ error: 'Nemáš oprávnenie' }, 401)
    const body = await req.json().catch(() => ({}))
    let token = await kvGet('todo_ics_token')
    if (!token || body.action === 'rotate') { token = newToken(); await kvSet('todo_ics_token', token) }
    return json({ token })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
