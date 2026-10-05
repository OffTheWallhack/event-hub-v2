// Google Drive cez Google Apps Script (beží v Robertovom Google účte, žiadne OAuth publikovanie).
// Appka pošle súbor skriptu s tajným kľúčom, skript ho uloží do Event Hub / Účty / YYYY-MM.
// V private_kv (len service role): drive_script_secret, drive_script_url, drive_email.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'

const ROOT = ['Event Hub', 'Účty']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function isAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data: u } = await admin.auth.getUser(token)
  if (!u.user) return false
  const { data: p } = await admin.from('profiles').select('role').eq('user_id', u.user.id).maybeSingle()
  return p?.role === 'admin'
}

async function secret(): Promise<string> {
  let s = await kvGet('drive_script_secret')
  if (!s) {
    s = encodeBase64(crypto.getRandomValues(new Uint8Array(24))).replace(/[^a-zA-Z0-9]/g, '')
    await kvSet('drive_script_secret', s)
  }
  return s
}

// Kód, ktorý Robert vloží do script.google.com.
function scriptCode(s: string) {
  return `// Event Hub – ukladanie dokladov do Google Drive
const SECRET = '${s}';

function doPost(e) {
  const req = JSON.parse(e.postData.contents);
  if (req.secret !== SECRET) return out({ error: 'Nesprávny kľúč' });
  if (req.action === 'ping') return out({ ok: true, email: Session.getEffectiveUser().getEmail() });
  let folder = DriveApp.getRootFolder();
  for (const name of req.folders) {
    const it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  }
  const blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mime, req.name);
  const file = folder.createFile(blob);
  return out({ id: file.getId(), name: file.getName(), url: file.getUrl() });
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`
}

async function callScript(url: string, body: Record<string, unknown>) {
  // Apps Script odpovedá presmerovaním, fetch ho nasleduje
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: await secret(), ...body }) })
  const text = await res.text()
  let data: Record<string, unknown>
  try { data = JSON.parse(text) } catch { throw new Error('Skript neodpovedá správne. Skontroluj, že je nasadený ako Web app s prístupom „Anyone“.') }
  if (data.error) throw new Error(String(data.error))
  return data
}

// „Lidl Senec“ → „lidl-senec“
function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'doklad'
}

async function upload(form: FormData) {
  const url = await kvGet('drive_script_url')
  if (!url) throw new Error('Google Drive nie je prepojený (Nastavenia → Google Drive).')
  const file = form.get('file')
  if (!(file instanceof File)) throw new Error('Chýba súbor.')
  const date = String(form.get('date') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Chýba dátum.')
  const amount = Number(form.get('amount') ?? 0).toFixed(2)
  const ext = (file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? file.type.split('/')[1] ?? 'jpg').toLowerCase()
  const name = `${date}_${amount}_${slug(String(form.get('shop') ?? ''))}.${ext}`
  const data = encodeBase64(new Uint8Array(await file.arrayBuffer()))
  const res = await callScript(url, { folders: [...ROOT, date.slice(0, 7)], name, mime: file.type || 'application/octet-stream', data })
  return { id: res.id, name: res.name, url: res.url }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Len POST' }, 405)
  try {
    if (!(await isAdmin(req))) return json({ error: 'Nemáš oprávnenie' }, 401)
    const type = req.headers.get('content-type') ?? ''
    if (type.includes('multipart/form-data')) return json(await upload(await req.formData()))

    const body = await req.json().catch(() => ({}))
    switch (body.action) {
      case 'status': {
        const url = await kvGet('drive_script_url')
        return json({ connected: !!url, email: url ? await kvGet('drive_email') : null })
      }
      case 'script':
        return json({ code: scriptCode(await secret()) })
      case 'connect': {
        const url = String(body.url ?? '').trim()
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
          return json({ error: 'Adresa musí vyzerať ako https://script.google.com/macros/s/…/exec' }, 400)
        }
        const ping = await callScript(url, { action: 'ping' })
        await kvSet('drive_script_url', url)
        if (ping.email) await kvSet('drive_email', String(ping.email))
        return json({ connected: true, email: ping.email ?? null })
      }
      case 'disconnect':
        await admin.from('private_kv').delete().in('key', ['drive_script_url', 'drive_email'])
        return json({ ok: true })
      default:
        return json({ error: 'Neznáma akcia' }, 400)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
