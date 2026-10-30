import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { CalendarDays, Car, ChevronLeft, FileDown, MapPin } from 'lucide-react'
import { Empty, ErrorText, KV, Section, dayWord } from '../components/ui'
import { supabase } from '../lib/supabase'
import { type Flavor, flavorName, flavorStyle } from '../lib/cartons'
import { type EventPhoto, loadEventPhotos } from '../lib/eventPhotos'
import { applyMode, loadMode } from '../lib/theme'
import { type EventRow, DEPT_LABEL, TYPE_LABEL, durationDays, fmtRange, startDay } from '../lib/events'

type Ev = Pick<EventRow, 'id' | 'title' | 'start_date' | 'end_date' | 'location' | 'event_type' | 'departments' | 'spectators' | 'status'>
type Data = {
  ev: Ev
  vehicles: { name: string; primary: boolean }[]
  gear: { name: string; quantity: number }[]
  cartons: { flavor: Pick<Flavor, 'name' | 'label' | 'color_bg' | 'color_text' | 'color_border'>; n: number; order: number }[]
  photos: EventPhoto[]
}

/**
 * Export jedného eventu pre šéfa: základné info, autá, technika, Red Bull kartóny a fotky.
 * Bez financií a bez interných poznámok. „Uložiť PDF“ = tlač stránky (na iPhone Zdieľať → Uložiť do Súborov).
 */
export function EventExportPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const [d, setD] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setD(null); setError(null)
    ;(async () => {
      const [e, v, g, c] = await Promise.all([
        supabase.from('events').select('id, title, start_date, end_date, location, event_type, departments, spectators, status').eq('id', id).maybeSingle(),
        supabase.from('event_vehicles').select('is_primary, vehicles(name, sort_order)').eq('event_id', id),
        supabase.from('event_equipment').select('quantity, equipment(name)').eq('event_id', id),
        supabase.from('carton_movements').select('cartons, flavor_id, flavors(name, label, color_bg, color_text, color_border, sort_order)').eq('event_id', id).eq('type', 'event'),
      ])
      const err = e.error ?? v.error ?? g.error ?? c.error
      if (err) throw new Error(err.message)
      if (!e.data) throw new Error('Event sa nenašiel.')
      const photos = await loadEventPhotos(id).catch(() => [] as EventPhoto[])

      type V = { is_primary: boolean; vehicles: { name: string; sort_order: number } | null }
      const vehicles = ((v.data ?? []) as unknown as V[])
        .filter((x) => x.vehicles)
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.vehicles!.sort_order - b.vehicles!.sort_order)
        .map((x) => ({ name: x.vehicles!.name, primary: x.is_primary }))

      type G = { quantity: number; equipment: { name: string } | null }
      const gear = ((g.data ?? []) as unknown as G[])
        .filter((x) => x.equipment && x.quantity > 0)
        .map((x) => ({ name: x.equipment!.name, quantity: x.quantity }))
        .sort((a, b) => a.name.localeCompare(b.name, 'sk'))

      type C = { cartons: number; flavor_id: string; flavors: (Data['cartons'][number]['flavor'] & { sort_order: number }) | null }
      const byFlavor = new Map<string, Data['cartons'][number]>()
      for (const row of (c.data ?? []) as unknown as C[]) {
        if (!row.flavors) continue
        const cur = byFlavor.get(row.flavor_id) ?? { flavor: row.flavors, n: 0, order: row.flavors.sort_order }
        cur.n += -row.cartons // pohyby „Na event“ sú záporné
        byFlavor.set(row.flavor_id, cur)
      }
      const cartons = [...byFlavor.values()].filter((x) => x.n > 0).sort((a, b) => a.order - b.order)

      if (alive) setD({ ev: e.data as Ev, vehicles, gear, cartons, photos })
    })().catch((x) => alive && setError((x as Error).message))
    return () => { alive = false }
  }, [id])

  // Názov PDF súboru = názov stránky
  useEffect(() => {
    if (!d) return
    const prev = document.title
    document.title = `${startDay(d.ev)} ${d.ev.title}`
    return () => { document.title = prev }
  }, [d])

  // Po návrate z tlače (alebo pri odchode zo stránky) vráť zvolenú tému
  useEffect(() => {
    const restore = () => applyMode(loadMode())
    window.addEventListener('afterprint', restore)
    return () => { window.removeEventListener('afterprint', restore); restore() }
  }, [])

  function savePdf() {
    // PDF vždy na bielom papieri: na chvíľu svetlá téma (bez uloženia voľby)
    const root = document.documentElement
    root.dataset.theme = 'light'
    root.dataset.dark = 'false'
    root.style.colorScheme = 'light'
    window.setTimeout(() => window.print(), 50)
  }

  const back = (
    <div className="flex items-center gap-2 no-print">
      <Link to="/event/$id" params={{ id }} className="btn btn-sm btn-quiet -ml-3 flex-1 justify-start"><ChevronLeft aria-hidden />Späť na event</Link>
      {d && <button onClick={savePdf} className="btn btn-sm btn-primary"><FileDown aria-hidden />Uložiť PDF</button>}
    </div>
  )

  if (error) return <div className="page">{back}<ErrorText>{error}</ErrorText></div>
  if (!d) return <div className="page">{back}<p className="muted">Načítavam…</p></div>

  const { ev, vehicles, gear, cartons, photos } = d
  const days = durationDays(ev)
  const pieces = gear.reduce((s, g) => s + g.quantity, 0)
  const cartonSum = cartons.reduce((s, c) => s + c.n, 0)

  return (
    <div className="page" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {back}

      <header className="card section">
        <p className="eyebrow">Red Bull · Event Car · export eventu</p>
        <h1 className="page-title !text-[1.75rem] mt-2">{ev.title}</h1>
        <p className="mt-2 flex items-start gap-2 font-medium">
          <CalendarDays className="w-4 h-4 muted shrink-0 mt-[0.2em]" aria-hidden />
          <span>{fmtRange(ev)} <span className="muted font-normal">· {days} {dayWord(days)}</span></span>
        </p>
        {ev.location && (
          <p className="mt-1 flex items-start gap-2">
            <MapPin className="w-4 h-4 muted shrink-0 mt-[0.2em]" aria-hidden />
            <span>{ev.location}</span>
          </p>
        )}
        {ev.status === 'cancelled' && <span className="badge badge-danger mt-2">Zrušený</span>}
      </header>

      <Section title="Základné info">
        <dl className="kv">
          <KV label="Typ">{TYPE_LABEL[ev.event_type]}</KV>
          <KV label="Oddelenie">{ev.departments.map((x) => DEPT_LABEL[x]).join(', ')}</KV>
          <KV label="Autá">
            {vehicles.length > 0 && (
              <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
                {vehicles.map((v) => (
                  <span key={v.name} className="inline-flex items-center gap-1"><Car className="w-4 h-4 muted" aria-hidden />{v.name}</span>
                ))}
              </span>
            )}
          </KV>
          {ev.spectators != null && ev.spectators > 0 && <KV label="Diváci">{ev.spectators}</KV>}
        </dl>
      </Section>

      <Section title={<>Technika{pieces ? <span className="muted font-normal"> · {pieces} ks</span> : ''}</>}>
        {gear.length === 0 ? (
          <Empty>Bez techniky.</Empty>
        ) : (
          <ul className="list text-sm">
            {gear.map((g) => (
              <li key={g.name} className="py-2 flex gap-3"><b className="w-8 num shrink-0">{g.quantity}×</b><span>{g.name}</span></li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={<>Red Bull{cartonSum ? <span className="muted font-normal"> · {cartonSum} {cartonWord(cartonSum)}</span> : ''}</>}>
        {cartons.length === 0 ? (
          <Empty>Bez kartónov.</Empty>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cartons.map((c) => (
              <li key={c.flavor.name} className="rounded-[var(--ctl-r)] border-2 px-3 py-2 flex items-center justify-between gap-2" style={flavorStyle(c.flavor)}>
                <span className="font-semibold text-sm leading-tight truncate">{flavorName(c.flavor)}</span>
                <b className="num text-lg">{c.n}×</b>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={<>Fotky{photos.length ? <span className="muted font-normal"> · {photos.length}</span> : ''}</>}>
        {photos.length === 0 ? (
          <Empty>Bez fotiek. Pridáš ich na stránke eventu v časti Fotky.</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((p) => (
              <img key={p.id} src={p.url} alt="" className="w-full h-auto rounded-[var(--ctl-r)] break-inside-avoid" />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

const cartonWord = (n: number) => (n === 1 ? 'kartón' : n >= 2 && n <= 4 ? 'kartóny' : 'kartónov')
