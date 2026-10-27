// Trasa z Bratislavy k miestu eventu: nájde miesto (OpenStreetMap Nominatim) a spočíta cestu autom (OSRM).
// Volá ju prihlásená appka; výsledok zapíše do events.route_km / route_min / route_for (len admin).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// štart: centrum Bratislavy (lon, lat)
const FROM = { lon: 17.1077, lat: 48.1486 }
const UA = 'event-hub-v2/1.0 (osobna appka)'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Len POST' }, 405)
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const url = Deno.env.get('SUPABASE_URL')!
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
    const { data: isAdmin } = await asUser.rpc('is_admin')
    if (!isAdmin) return json({ error: 'Len admin.' }, 403)

    const { event_id } = await req.json().catch(() => ({ event_id: '' }))
    if (typeof event_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(event_id)) return json({ error: 'Neplatný event.' }, 400)

    const { data: ev } = await asUser.from('events').select('location').eq('id', event_id).maybeSingle()
    const place = ev?.location?.trim()
    if (!place) {
      await asUser.from('events').update({ route_km: null, route_min: null, route_for: null }).eq('id', event_id)
      return json({ ok: true, found: false })
    }

    // 1) kde to je
    const geo = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=sk,cz,at,hu,pl&q=${encodeURIComponent(place)}`, { headers: { 'User-Agent': UA } })
    const hit = geo.ok ? ((await geo.json()) as { lat: string; lon: string }[])[0] : undefined
    if (!hit) {
      await asUser.from('events').update({ route_km: null, route_min: null, route_for: place }).eq('id', event_id)
      return json({ ok: true, found: false })
    }

    // 2) trasa autom
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${FROM.lon},${FROM.lat};${hit.lon},${hit.lat}?overview=false`, { headers: { 'User-Agent': UA } })
    const route = r.ok ? ((await r.json()) as { routes?: { distance: number; duration: number }[] }).routes?.[0] : undefined
    if (!route) return json({ error: 'Trasu sa nepodarilo vypočítať.' }, 502)

    const km = Math.round(route.distance / 100) / 10
    const min = Math.round(route.duration / 60)
    const { error } = await asUser.from('events').update({ route_km: km, route_min: min, route_for: place }).eq('id', event_id)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true, found: true, km, min })
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500)
  }
})
