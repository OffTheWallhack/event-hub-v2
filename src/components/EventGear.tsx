import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type Vehicle = { id: string; name: string; sort_order: number }
type EvVehicle = { vehicle_id: string; is_primary: boolean }
type EqItem = { id: string; name: string; quantity: number; active: boolean }
type EvEquip = { equipment_id: string; quantity: number; issue: string; equipment: { name: string } | null }
type SetItems = { vehicle_id: string | null; equipment_set_items: { equipment_id: string; quantity: number }[] }

const ISSUE_LABEL: Record<string, string> = { broken: 'pokazené', not_returned: 'nevrátené' }

/** Vozidlá a technika na evente. Výber auta automaticky pridá jeho sadu techniky. */
export function EventGear({ eventId, isAdmin }: { eventId: string; isAdmin: boolean }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [evVeh, setEvVeh] = useState<EvVehicle[]>([])
  const [catalog, setCatalog] = useState<EqItem[]>([])
  const [evEq, setEvEq] = useState<EvEquip[]>([])
  const [editVeh, setEditVeh] = useState(false)
  const [editEq, setEditEq] = useState(false)
  const [pick, setPick] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, name, sort_order').eq('active', true).order('sort_order'),
      supabase.from('event_vehicles').select('vehicle_id, is_primary').eq('event_id', eventId),
      supabase.from('equipment').select('id, name, quantity, active').order('name'),
      supabase.from('event_equipment').select('equipment_id, quantity, issue, equipment(name)').eq('event_id', eventId),
    ]).then(([v, ev, c, ee]) => {
      const err = v.error ?? ev.error ?? c.error ?? ee.error
      if (err) return setError(err.message)
      setVehicles(v.data as Vehicle[])
      setEvVeh(ev.data as EvVehicle[])
      setCatalog(c.data as EqItem[])
      setEvEq((ee.data as unknown as EvEquip[]).sort((a, b) => (a.equipment?.name ?? '').localeCompare(b.equipment?.name ?? '')))
    })
  }, [eventId, reload])

  const refresh = () => setReload((r) => r + 1)
  const fail = (e: { message: string } | null) => { if (e) { setError(e.message); return true } return false }

  async function toggleVehicle(v: Vehicle) {
    setMsg(null)
    const on = evVeh.some((x) => x.vehicle_id === v.id)
    if (on) {
      // technika zo sady ostane, odober ju ručne ak treba
      if (fail((await supabase.from('event_vehicles').delete().eq('event_id', eventId).eq('vehicle_id', v.id)).error)) return
      return refresh()
    }
    const ins = await supabase.from('event_vehicles').insert({ event_id: eventId, vehicle_id: v.id, is_primary: evVeh.length === 0 })
    if (fail(ins.error)) return
    // pridaj sadu auta (len kusy, ktoré na evente ešte nie sú)
    const { data: sets } = await supabase.from('equipment_sets').select('vehicle_id, equipment_set_items(equipment_id, quantity)').eq('vehicle_id', v.id)
    const have = new Set(evEq.map((e) => e.equipment_id))
    const rows = ((sets ?? []) as SetItems[])
      .flatMap((s) => s.equipment_set_items)
      .filter((i) => !have.has(i.equipment_id))
      .map((i) => ({ event_id: eventId, equipment_id: i.equipment_id, quantity: i.quantity }))
    if (rows.length) {
      if (fail((await supabase.from('event_equipment').insert(rows)).error)) return
      setMsg(`Pridaná sada ${v.name}: ${rows.length} ${rows.length === 1 ? 'položka' : 'položky'}.`)
    }
    refresh()
  }

  async function makePrimary(vehicleId: string) {
    if (fail((await supabase.from('event_vehicles').update({ is_primary: false }).eq('event_id', eventId)).error)) return
    if (fail((await supabase.from('event_vehicles').update({ is_primary: true }).eq('event_id', eventId).eq('vehicle_id', vehicleId)).error)) return
    refresh()
  }

  async function setQty(equipmentId: string, q: number) {
    const max = catalog.find((c) => c.id === equipmentId)?.quantity ?? 99
    const res = q <= 0
      ? await supabase.from('event_equipment').delete().eq('event_id', eventId).eq('equipment_id', equipmentId)
      : await supabase.from('event_equipment').update({ quantity: Math.min(q, Math.max(max, 1)) }).eq('event_id', eventId).eq('equipment_id', equipmentId)
    if (!fail(res.error)) refresh()
  }

  async function addItem() {
    if (!pick) return
    if (fail((await supabase.from('event_equipment').insert({ event_id: eventId, equipment_id: pick, quantity: 1 })).error)) return
    setPick('')
    refresh()
  }

  const evVehNames = vehicles
    .filter((v) => evVeh.some((x) => x.vehicle_id === v.id))
    .sort((a, b) => Number(isPrimary(b.id)) - Number(isPrimary(a.id)))
  function isPrimary(id: string) { return evVeh.find((x) => x.vehicle_id === id)?.is_primary ?? false }
  const available = catalog.filter((c) => c.active && !evEq.some((e) => e.equipment_id === c.id))

  return (
    <>
      <Card
        title="Vozidlá"
        right={isAdmin && <button onClick={() => setEditVeh(!editVeh)} className="h-9 px-3 rounded-lg border line text-sm font-medium">{editVeh ? 'Hotovo' : 'Upraviť'}</button>}
      >
        {error && <p className="text-[var(--color-signal)] text-sm mb-2">{error}</p>}
        {editVeh ? (
          <>
            <div className="flex flex-wrap gap-1">
              {vehicles.map((v) => {
                const on = evVeh.some((x) => x.vehicle_id === v.id)
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleVehicle(v)}
                    className={'h-10 px-3 rounded-lg border line text-sm ' + (on ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)] font-semibold' : '')}
                  >
                    {v.name}
                  </button>
                )
              })}
            </div>
            <p className="text-xs muted mt-2">Výber auta pridá jeho sadu techniky. Odobratie auta techniku neodoberie.</p>
          </>
        ) : evVehNames.length === 0 ? (
          <p className="muted text-sm">Žiadne.</p>
        ) : (
          <ul className="flex flex-wrap gap-2 text-sm">
            {evVehNames.map((v) => (
              <li key={v.id} className="px-2 py-1 rounded-lg border line flex items-center gap-1">
                {isPrimary(v.id) ? <span title="Hlavné auto">★</span> : isAdmin && (
                  <button onClick={() => makePrimary(v.id)} className="muted" title="Nastaviť ako hlavné">☆</button>
                )}
                <span className="font-semibold">{v.name}</span>
              </li>
            ))}
          </ul>
        )}
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </Card>

      <Card
        title="Technika"
        right={isAdmin && <button onClick={() => setEditEq(!editEq)} className="h-9 px-3 rounded-lg border line text-sm font-medium">{editEq ? 'Hotovo' : 'Upraviť'}</button>}
      >
        {evEq.length === 0 && !editEq ? (
          <p className="muted text-sm">Žiadna.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {evEq.map((e) => (
              <li key={e.equipment_id} className="flex items-center gap-2 min-h-9">
                {editEq ? (
                  <span className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setQty(e.equipment_id, e.quantity - 1)} className="w-8 h-8 rounded-lg border line" aria-label="Menej">−</button>
                    <span className="w-6 text-center font-semibold">{e.quantity}</span>
                    <button onClick={() => setQty(e.equipment_id, e.quantity + 1)} className="w-8 h-8 rounded-lg border line" aria-label="Viac">+</button>
                  </span>
                ) : (
                  <span className="font-semibold w-8 shrink-0">{e.quantity}×</span>
                )}
                <span className="flex-1 min-w-0 truncate">{e.equipment?.name}</span>
                {e.issue !== 'none' && <span className="text-[var(--color-signal)] font-semibold">{ISSUE_LABEL[e.issue]}</span>}
              </li>
            ))}
          </ul>
        )}
        {editEq && (
          <div className="flex gap-2 mt-3">
            <select className="flex-1 min-w-0 h-10 px-2 rounded-lg border line bg-transparent text-sm" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">+ pridať techniku…</option>
              {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={addItem} disabled={!pick} className="h-10 px-4 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-50">Pridať</button>
          </div>
        )}
        {editEq && <p className="text-xs muted mt-2">Znížením na 0 sa položka z eventu odoberie.</p>}
      </Card>
    </>
  )
}

function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="card p-4 min-w-0">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="display text-xl font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  )
}
