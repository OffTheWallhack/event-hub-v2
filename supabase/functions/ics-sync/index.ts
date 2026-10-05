// ICS sync z Basecampu → tabuľka events.
// Spúšťa: admin (tlačidlo v appke, Authorization: Bearer <user JWT>) alebo cron (hlavička x-cron-secret).
// Mení len Basecamp polia (title, start_date, end_date, basecamp_notes, basecamp_url).
import ICAL from 'npm:ical.js@2.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const IMPORT_FROM = '2026-01-01'
const TZ = 'Europe/Bratislava'
const SYNC_KEY = 'basecamp_ical'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

// Deň (YYYY-MM-DD) v slovenskom čase.
function localDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
function localHour(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d))
}
function addDays(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

type Parsed = { uid: string; title: string; start: string; end: string; notes: string | null; url: string | null }

function parseFeed(text: string): Parsed[] {
  const comp = new ICAL.Component(ICAL.parse(text))
  const out: Parsed[] = []
  for (const ve of comp.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(ve)
    if (!ev.uid || !ev.startDate) continue
    const isDate = ev.startDate.isDate
    let start: string, end: string
    if (isDate) {
      // celodenný event: DTEND je exkluzívny
      start = ev.startDate.toString().slice(0, 10)
      end = ev.endDate ? addDays(ev.endDate.toString().slice(0, 10), -1) : start
    } else {
      const s = ev.startDate.toJSDate()
      const e = ev.endDate ? ev.endDate.toJSDate() : s
      start = localDay(s)
      end = localDay(e)
      // večerný event končiaci po polnoci (do 6:00) patrí k predošlému dňu
      if (end > start && localHour(e) < 6) end = addDays(end, -1)
    }
    if (end < start) end = start
    out.push({
      uid: String(ev.uid),
      title: (ev.summary || '(bez názvu)').trim(),
      start,
      end,
      notes: ev.description || null,
      url: (ve.getFirstPropertyValue('url') as string | null) || null,
    })
  }
  return out
}

// Číselné ID z Basecampu (z odkazu alebo UID) – záložné párovanie.
function basecampId(p: Parsed): string | null {
  const m = (p.url ?? '').match(/schedule_entries\/(\d+)/) ?? p.uid.match(/(\d{6,})/)
  return m ? m[1] : null
}

async function isAuthorized(req: Request): Promise<boolean> {
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret) {
    const { data } = await admin.from('app_settings').select('value').eq('key', 'sync_cron_secret').maybeSingle()
    return !!data?.value && data.value === cronSecret
  }
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data: u } = await admin.auth.getUser(token)
  if (!u.user) return false
  const { data: p } = await admin.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
  return p?.role === 'admin'
}

async function saveStatus(result: unknown, error: string | null) {
  const now = new Date().toISOString()
  await admin.from('sync_status').upsert({ key: SYNC_KEY, last_synced_at: now, last_result: result, last_error: error, updated_at: now })
}

async function sync() {
  const icsUrl = (Deno.env.get('BASECAMP_ICAL_URL') ?? '').trim().replace(/^webcal:\/\//i, 'https://')
  if (!icsUrl) throw new Error('Chýba secret BASECAMP_ICAL_URL (Supabase → Edge Functions → Secrets).')

  const res = await fetch(icsUrl, { headers: { Accept: 'text/calendar' } })
  if (!res.ok) throw new Error(`Basecamp vrátil chybu ${res.status}`)
  const all = parseFeed(await res.text())
  const feed = all.filter((p) => p.start >= IMPORT_FROM)
  // Poistka: prázdny feed by inak zrušil všetky eventy.
  if (feed.length === 0) throw new Error(`Feed neobsahuje žiadne eventy od ${IMPORT_FROM}, nič som nemenil.`)

  const { data: rows, error } = await admin
    .from('events')
    .select('id, ical_uid, title, start_date, end_date, basecamp_notes, basecamp_url, status, deleted_from_basecamp')
    .not('ical_uid', 'is', null)
  if (error) throw error
  const byUid = new Map(rows!.map((r) => [r.ical_uid as string, r]))

  let added = 0, updated = 0, unchanged = 0, restored = 0, removed = 0
  const seen = new Set<string>()

  for (const p of feed) {
    const row = byUid.get(p.uid) ?? (basecampId(p) ? byUid.get(basecampId(p)!) : undefined)
    const fields = {
      title: p.title,
      start_date: p.start + 'T00:00:00Z',
      end_date: p.end + 'T00:00:00Z',
      basecamp_notes: p.notes,
      basecamp_url: p.url,
    }
    if (!row) {
      const { error } = await admin.from('events').insert({ ical_uid: p.uid, ...fields })
      if (error) throw error
      seen.add(p.uid)
      added++
      continue
    }
    seen.add(row.ical_uid as string)
    const same =
      row.title === fields.title &&
      String(row.start_date).slice(0, 10) === p.start &&
      String(row.end_date ?? row.start_date).slice(0, 10) === p.end &&
      (row.basecamp_notes ?? null) === fields.basecamp_notes &&
      (row.basecamp_url ?? null) === fields.basecamp_url
    const patch: Record<string, unknown> = same ? {} : { ...fields }
    if (row.deleted_from_basecamp) {
      // event sa vrátil do Basecampu
      patch.deleted_from_basecamp = false
      patch.deleted_from_basecamp_at = null
      if (row.status === 'cancelled') patch.status = 'planned'
      restored++
    }
    if (Object.keys(patch).length === 0) { unchanged++; continue }
    const { error } = await admin.from('events').update(patch).eq('id', row.id)
    if (error) throw error
    if (!same) updated++
  }

  // Zmiznuté z Basecampu (od IMPORT_FROM) → zrušené, nikdy sa nemažú.
  const now = new Date().toISOString()
  for (const r of rows!) {
    if (seen.has(r.ical_uid as string) || r.deleted_from_basecamp) continue
    if (String(r.start_date).slice(0, 10) < IMPORT_FROM) continue
    // Basecamp rozhoduje: čo v ňom nie je, je zrušené (aj keď bolo hotové).
    const patch = { deleted_from_basecamp: true, deleted_from_basecamp_at: now, status: 'cancelled' }
    const { error } = await admin.from('events').update(patch).eq('id', r.id)
    if (error) throw error
    removed++
  }

  return { total: feed.length, added, updated, unchanged, restored, removed }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Len POST' }, 405)
  if (!(await isAuthorized(req))) return json({ error: 'Nemáš oprávnenie' }, 401)
  try {
    const result = await sync()
    await saveStatus(result, null)
    return json({ ok: true, result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await saveStatus(null, msg)
    return json({ ok: false, error: msg }, 500)
  }
})
