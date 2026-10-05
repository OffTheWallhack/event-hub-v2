import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { type EqCategory, CATEGORIES, CATEGORY_LABEL, eqIcon, splitName } from '../lib/equipment'

type Vehicle = { id: string; name: string; sort_order: number }
type EvVehicle = { vehicle_id: string; is_primary: boolean }
type EqItem = { id: string; name: string; category: EqCategory; quantity: number; qty_broken: number; active: boolean }
type EvEquip = { equipment_id: string; quantity: number; issue: string }
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
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('vehicles').select('id, name, sort_order').eq('active', true).order('sort_order'),
      supabase.from('event_vehicles').select('vehicle_id, is_primary').eq('event_id', eventId),
      supabase.from('equipment').select('id, name, category, quantity, qty_broken, active').order('name'),
      supabase.from('event_equipment').select('equipment_id, quantity, issue').eq('event_id', eventId),
    ]).then(([v, ev, c, ee]) => {
      const err = v.error ?? ev.error ?? c.error ?? ee.error
      if (err) return setError(err.message)
      setVehicles(v.data as Vehicle[])
      setEvVeh(ev.data as EvVehicle[])
      setCatalog(c.data as EqItem[])
      setEvEq(ee.data as EvEquip[])
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

  // Zmena počtu kusov na evente (0 = odobrať). Hneď sa prekreslí, pri chybe sa načíta znova.
  async function setQty(equipmentId: string, q: number) {
    const total = catalog.find((c) => c.id === equipmentId)?.quantity ?? 99
    const next = Math.max(0, Math.min(q, Math.max(total, 1)))
    const cur = evEq.find((e) => e.equipment_id === equipmentId)
    if ((cur?.quantity ?? 0) === next) return
    setEvEq((list) =>
      next === 0
        ? list.filter((e) => e.equipment_id !== equipmentId)
        : cur
          ? list.map((e) => (e.equipment_id === equipmentId ? { ...e, quantity: next } : e))
          : [...list, { equipment_id: equipmentId, quantity: next, issue: 'none' }],
    )
    const res = next === 0
      ? await supabase.from('event_equipment').delete().eq('event_id', eventId).eq('equipment_id', equipmentId)
      : cur
        ? await supabase.from('event_equipment').update({ quantity: next }).eq('event_id', eventId).eq('equipment_id', equipmentId)
        : await supabase.from('event_equipment').insert({ event_id: eventId, equipment_id: equipmentId, quantity: next })
    if (fail(res.error)) refresh()
  }

  const evVehNames = vehicles
    .filter((v) => evVeh.some((x) => x.vehicle_id === v.id))
    .sort((a, b) => Number(isPrimary(b.id)) - Number(isPrimary(a.id)))
  function isPrimary(id: string) { return evVeh.find((x) => x.vehicle_id === id)?.is_primary ?? false }
  const onEvent = new Map(evEq.map((e) => [e.equipment_id, e]))
  // v úprave: všetka aktívna technika; inak len to, čo je na evente
  const groups = CATEGORIES.map((cat) => ({
    cat,
    items: catalog.filter((c) => c.category === cat && (editEq ? c.active || onEvent.has(c.id) : onEvent.has(c.id))),
  })).filter((g) => g.items.length > 0)
  const totalPieces = evEq.reduce((s, e) => s + e.quantity, 0)

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
        title={`Technika${totalPieces ? ` · ${totalPieces} ks` : ''}`}
        right={isAdmin && <button onClick={() => setEditEq(!editEq)} className="h-9 px-3 rounded-lg border line text-sm font-medium">{editEq ? 'Hotovo' : 'Upraviť'}</button>}
      >
        {groups.length === 0 ? (
          <p className="muted text-sm">Žiadna.</p>
        ) : (
          <div className="grid gap-4">
            {editEq && <p className="text-xs muted">Ťukni na kus = +1, mínus = −1. Číslo vpravo hore je počet na evente / koľko máme.</p>}
            {groups.map((g) => (
              <div key={g.cat}>
                <h3 className="text-xs font-semibold uppercase tracking-wider muted mb-1.5">{CATEGORY_LABEL[g.cat]}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {g.items.map((c) => {
                    const on = onEvent.get(c.id)
                    const q = on?.quantity ?? 0
                    const [short] = splitName(c.name)
                    return (
                      <div
                        key={c.id}
                        className={'relative rounded-xl border-2 text-center select-none ' + (q > 0 ? 'border-[var(--color-signal)] bg-[color-mix(in_srgb,var(--color-signal)_10%,var(--card))]' : 'line ' + (editEq ? '' : 'opacity-60'))}
                      >
                        <button
                          type="button"
                          disabled={!editEq}
                          onClick={() => setQty(c.id, q + 1)}
                          className="w-full pt-3 pb-2 px-1 flex flex-col items-center gap-1"
                        >
                          <span className="text-3xl leading-none">{eqIcon(c)}</span>
                          <span className="text-[11px] font-semibold leading-tight line-clamp-2">{short}</span>
                        </button>
                        <span className={'absolute top-1 right-1 text-[10px] font-bold px-1 rounded ' + (q > 0 ? 'bg-[var(--color-signal)] text-white' : 'muted')}>
                          {q}/{c.quantity}
                        </span>
                        {on && on.issue !== 'none' && (
                          <span className="block text-[10px] font-bold text-[var(--color-signal)] -mt-1 mb-1">{ISSUE_LABEL[on.issue]}</span>
                        )}
                        {c.qty_broken > 0 && editEq && (
                          <span className="block text-[10px] text-[var(--color-signal)] -mt-1 mb-1">{c.qty_broken} pokaz.</span>
                        )}
                        {editEq && q > 0 && (
                          <button
                            type="button"
                            onClick={() => setQty(c.id, q - 1)}
                            className="absolute top-1 left-1 w-7 h-7 rounded-full bg-[var(--color-ink)] text-white font-bold leading-none"
                            aria-label="Menej"
                          >
                            −
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
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
