// Google Drive: prepojenie (OAuth, scope drive.file) a nahrávanie dokladov.
// Priečinky si appka vytvorí sama: Event Hub / Účty / YYYY-MM.
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Refresh token je v private_kv (len service role).
import { createClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = 'https://event-hub-v2.rdurica1995.workers.dev'
const SCOPE = 'https://www.googleapis.com/auth/drive.file openid email'
const ROOT = ['Event Hub', 'Účty']
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const supaUrl = Deno.env.get('SUPABASE_URL')!
const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const clientId = () => Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const clientSecret = () => Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const redirectUri = `${supaUrl}/functions/v1/drive`

async function kvGet(key: string) {
  const { data } = await admin.from('private_kv').select('value, expires_at').eq('key', key).maybeSingle()
  if (!data) return null
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null
  return data.value as string
}
async function kvSet(key: string, value: string, expiresAt: string | null = null) {
  const { error } = await admin.from('private_kv').upsert({ key, value, expires_at: expiresAt, updated_at: new Date().toISOString() })
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

async function accessToken(): Promise<string> {
  const refresh = await kvGet('google_refresh_token')
  if (!refresh) throw new Error('Google Drive nie je prepojený (Nastavenia → Google Drive).')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), refresh_token: refresh, grant_type: 'refresh_token' }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`Google odmietol prístup (${body.error ?? res.status}). Prepoj Drive znova.`)
  return body.access_token
}

async function gfetch(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } })
  const body = await res.json()
  if (!res.ok) throw new Error(`Drive chyba: ${body.error?.message ?? res.status}`)
  return body
}

// Nájde alebo vytvorí podpriečinok (drive.file vidí len priečinky, ktoré vytvorila appka).
async function folder(token: string, name: string, parent: string | null): Promise<string> {
  const esc = name.replace(/'/g, "\\'")
  const q = `name='${esc}' and mimeType='${FOLDER_MIME}' and trashed=false` + (parent ? ` and '${parent}' in parents` : '')
  const found = await gfetch(token, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`)
  if (found.files?.length) return found.files[0].id
  const created = await gfetch(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }),
  })
  return created.id
}

// „Lidl Senec“ → „lidl-senec“
function slug(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'doklad'
}

async function upload(form: FormData) {
  const file = form.get('file')
  if (!(file instanceof File)) throw new Error('Chýba súbor.')
  const date = String(form.get('date') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Chýba dátum.')
  const amount = Number(form.get('amount') ?? 0).toFixed(2)
  const shop = slug(String(form.get('shop') ?? ''))
  const ext = (file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? file.type.split('/')[1] ?? 'jpg').toLowerCase()
  const name = `${date}_${amount}_${shop}.${ext}`

  const token = await accessToken()
  let parent: string | null = null
  for (const n of [...ROOT, date.slice(0, 7)]) parent = await folder(token, n, parent)

  const boundary = 'eventhub' + crypto.randomUUID()
  const meta = JSON.stringify({ name, parents: [parent] })
  const bytes = new Uint8Array(await file.arrayBuffer())
  const enc = new TextEncoder()
  const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`)
  const tail = enc.encode(`\r\n--${boundary}--`)
  const body = new Uint8Array(head.length + bytes.length + tail.length)
  body.set(head, 0); body.set(bytes, head.length); body.set(tail, head.length + bytes.length)

  const res = await gfetch(token, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return { id: res.id, name: res.name, url: res.webViewLink }
}

async function callback(url: URL): Promise<Response> {
  const back = (status: string) => Response.redirect(`${APP_URL}/nastavenia?drive=${status}`, 302)
  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code')
  if (!code || !state || (await kvGet('google_oauth_state')) !== state) return back('chyba')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  })
  const body = await res.json()
  if (!res.ok || !body.refresh_token) return back('chyba')
  await kvSet('google_refresh_token', body.refresh_token)
  // e-mail účtu len na zobrazenie v Nastaveniach
  try {
    const payload = JSON.parse(atob(body.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.email) await kvSet('google_drive_email', payload.email)
  } catch { /* nevadí */ }
  await admin.from('private_kv').delete().eq('key', 'google_oauth_state')
  return back('ok')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  try {
    // návrat z Google súhlasu
    if (req.method === 'GET') return await callback(url)

    if (!(await isAdmin(req))) return json({ error: 'Nemáš oprávnenie' }, 401)
    const configured = !!clientId() && !!clientSecret()
    const type = req.headers.get('content-type') ?? ''
    const { action } = type.includes('multipart/form-data') ? { action: 'upload' } : await req.json().catch(() => ({ action: '' }))
    if (action === 'status') {
      const connected = !!(await kvGet('google_refresh_token'))
      return json({ configured, connected, email: connected ? await kvGet('google_drive_email') : null })
    }
    if (!configured) return json({ error: 'Chýbajú secrets GOOGLE_CLIENT_ID a GOOGLE_CLIENT_SECRET.' }, 500)
    if (action === 'upload') return json(await upload(await req.formData()))
    if (action === 'start') {
      const state = crypto.randomUUID()
      await kvSet('google_oauth_state', state, new Date(Date.now() + 15 * 60_000).toISOString())
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      auth.search = new URLSearchParams({
        client_id: clientId(), redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
        access_type: 'offline', prompt: 'consent', state,
      }).toString()
      return json({ url: auth.toString() })
    }
    if (action === 'disconnect') {
      await admin.from('private_kv').delete().in('key', ['google_refresh_token', 'google_drive_email'])
      return json({ ok: true })
    }
    return json({ error: 'Neznáma akcia' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
