// Verejný odkaz pre externého vodiča (bez prihlásenia). Vracia LEN bezpečné polia – nikdy financie.
// Platí, kým token nie je zrušený a nevypršal (koniec eventu + 3 dni).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Len POST' }, 405)
  try {
    const { token } = await req.json().catch(() => ({ token: '' }))
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) return json({ error: 'Neplatný odkaz.' }, 404)

    const { data: t } = await admin.from('briefing_tokens').select('event_id, expires_at, revoked').eq('token', token).maybeSingle()
    if (!t || t.revoked) return json({ error: 'Odkaz neplatí.' }, 404)
    if (t.expires_at && new Date(t.expires_at) < new Date()) return json({ error: 'Platnosť odkazu vypršala.' }, 410)

    const { data: e, error } = await admin
      .from('events')
      .select(
        'title, start_date, end_date, basecamp_notes, location, location_url, planned_arrival, contact, description, status, ' +
          'event_vehicles(is_primary, vehicles(name, full_name)), event_drivers(position, drivers(name)), ' +
          'event_equipment(quantity, equipment(name)), carton_movements(cartons, type, flavors(name, label, sort_order))',
      )
      .eq('id', t.event_id)
      .maybeSingle()
    if (error || !e) return json({ error: 'Event sa nenašiel.' }, 404)

    const ev = e as any
    const cartons = new Map<string, { label: string; n: number; order: number }>()
    for (const m of ev.carton_movements ?? []) {
      if (m.type !== 'event' || !m.flavors) continue
      const key = m.flavors.name
      const cur = cartons.get(key) ?? { label: m.flavors.label || key, n: 0, order: m.flavors.sort_order ?? 0 }
      cur.n += -m.cartons
      cartons.set(key, cur)
    }
    // Poznámky z Basecampu sú interné: vodičovi neposielame riadky so sumami v eurách (honoráre, ceny),
    // interné odkazy (Basecamp, stará appka) ani prázdne zhluky riadkov.
    const notes = (ev.basecamp_notes ?? '')
      .split('\n')
      .filter((l: string) => !/(€|\beuro?s?\b)/i.test(l) && !/lovable\.app|basecamp\.com/i.test(l))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return json({
      title: ev.title,
      start_date: ev.start_date,
      end_date: ev.end_date,
      cancelled: ev.status === 'cancelled',
      notes: notes || null,
      description: ev.description,
      location: ev.location,
      location_url: ev.location_url,
      planned_arrival: ev.planned_arrival,
      contact: ev.contact,
      vehicles: [...(ev.event_vehicles ?? [])]
        .sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary))
        .map((v: any) => v.vehicles?.full_name || v.vehicles?.name)
        .filter(Boolean),
      drivers: [...(ev.event_drivers ?? [])].sort((a: any, b: any) => a.position - b.position).map((d: any) => d.drivers?.name).filter(Boolean),
      equipment: (ev.event_equipment ?? []).filter((x: any) => x.equipment).map((x: any) => ({ name: x.equipment.name, quantity: x.quantity })),
      cartons: [...cartons.values()].filter((c) => c.n > 0).sort((a, b) => a.order - b.order).map((c) => ({ label: c.label, n: c.n })),
      expires_at: t.expires_at,
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
