import { useEffect, useState } from 'react'
import { Car, Minus, Plus, Star } from 'lucide-react'
import { Empty, ErrorText } from './ui'
import { supabase } from '../lib/supabase'
import { type EqCategory, CATEGORIES, CATEGORY_LABEL, eqIcon, splitName } from '../lib/equipment'
import { Photo } from './Photo'

type Vehicle = { id: string; name: string; sort_order: number }
type EvVehicle = { vehicle_id: string; is_primary: boolean }
type EqItem = { id: string; name: string; category: EqCategory; quantity: number; qty_broken: number; active: boolean; photo_path: string | null }
type EvEquip = { equipment_id: string; quantity: number; issue: string }
type SetItems = { vehicle_id: string | null; equipment_set_items: { equipment_id: string; quantity: number }[] }

const ISSUE_LABEL: Record<string, string> = { broken: 'pokazené', not_returned: 'nevrátené' }

/**
 * Vozidlá a technika na evente (spoločný stav pre obe časti stránky).
 * Všetko sa ukladá hneď po ťuknutí. Výber auta automaticky pridá jeho sadu techniky.
 */
export function useEventGear(eventId: string) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [evVeh, setEvVeh] = useState<EvVehicle[]>([])
  const [catalog, setCatalog] = useState<EqItem[]>([])
  const [evEq, setEvEq] = useState<EvEquip[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('vehicles').select('id, name, sort_order').eq('active', true).order('sort_order'),
      supabase.from('event_vehicles').select('vehicle_id, is_primary').eq('event_id', eventId),
      supabase.from('equipment').select('id, name, category, quantity, qty_broken, active, photo_path').order('name'),
      supabase.from('event_equipment').select('equipment_id, quantity, issue').eq('event_id', eventId),
    ]).then(([v, ev, c, ee]) => {
      if (!alive) return
      const err = v.error ?? ev.error ?? c.error ?? ee.error
      if (err) return setError(err.message)
      setVehicles(v.data as Vehicle[])
      setEvVeh(ev.data as EvVehicle[])
      setCatalog(c.data as EqItem[])
      setEvEq(ee.data as EvEquip[])
    })
    return () => { alive = false }
  }, [eventId, reload])

  const refresh = () => setReload((r) => r + 1)
  const fail = (e: { message: string } | null) => { if (e) { setError(e.message); return true } return false }

  async function toggleVehicle(v: Vehicle) {
    setMsg(null); setError(null)
    const on = evVeh.some((x) => x.vehicle_id === v.id)
    if (on) {
      // technika zo sady ostane, odober ju ručne ak treba
      setEvVeh((l) => l.filter((x) => x.vehicle_id !== v.id))
      if (fail((await supabase.from('event_vehicles').delete().eq('event_id', eventId).eq('vehicle_id', v.id)).error)) return refresh()
      return refresh()
    }
    setEvVeh((l) => [...l, { vehicle_id: v.id, is_primary: l.length === 0 }])
    const ins = await supabase.from('event_vehicles').insert({ event_id: eventId, vehicle_id: v.id, is_primary: evVeh.length === 0 })
    if (fail(ins.error)) return refresh()
    // pridaj sadu auta (len kusy, ktoré na evente ešte nie sú)
    const { data: sets } = await supabase.from('equipment_sets').select('vehicle_id, equipment_set_items(equipment_id, quantity)').eq('vehicle_id', v.id)
    const have = new Set(evEq.map((e) => e.equipment_id))
    const rows = ((sets ?? []) as SetItems[])
      .flatMap((s) => s.equipment_set_items)
      .filter((i) => !have.has(i.equipment_id))
      .map((i) => ({ event_id: eventId, equipment_id: i.equipment_id, quantity: i.quantity }))
    if (rows.length) {
      if (fail((await supabase.from('event_equipment').insert(rows)).error)) return refresh()
      setMsg(`Pridaná sada ${v.name}: ${rows.length} ${rows.length === 1 ? 'položka' : rows.length < 5 ? 'položky' : 'položiek'}.`)
    }
    refresh()
  }

  async function makePrimary(vehicleId: string) {
    setEvVeh((l) => l.map((x) => ({ ...x, is_primary: x.vehicle_id === vehicleId })))
    if (fail((await supabase.from('event_vehicles').update({ is_primary: false }).eq('event_id', eventId)).error)) return refresh()
    if (fail((await supabase.from('event_vehicles').update({ is_primary: true }).eq('event_id', eventId).eq('vehicle_id', vehicleId)).error)) return refresh()
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

  return { vehicles, evVeh, catalog, evEq, msg, error, toggleVehicle, makePrimary, setQty }
}
export type Gear = ReturnType<typeof useEventGear>

/** Vozidlá: admin ťuká na auto (zap/vyp) a hviezdičkou určí hlavné; ostatní vidia len vybrané. */
export function VehicleChips({ gear, isAdmin }: { gear: Gear; isAdmin: boolean }) {
  const { vehicles, evVeh, msg, error, toggleVehicle, makePrimary } = gear
  const isOn = (id: string) => evVeh.some((x) => x.vehicle_id === id)
  const isPrimary = (id: string) => evVeh.find((x) => x.vehicle_id === id)?.is_primary ?? false
  const list = isAdmin ? vehicles : vehicles.filter((v) => isOn(v.id))

  return (
    <div>
      <ErrorText>{error}</ErrorText>
      {list.length === 0 ? (
        <Empty>Žiadne.</Empty>
      ) : (
        <div className="chips">
          {list.map((v) => (
            <span key={v.id} className="inline-flex gap-1">
              {isAdmin ? (
                <button type="button" aria-pressed={isOn(v.id)} onClick={() => toggleVehicle(v)} className="chip">
                  {isOn(v.id) && !isPrimary(v.id) && <Car className="w-4 h-4" aria-hidden />}
                  {isOn(v.id) && isPrimary(v.id) && <Star className="w-4 h-4 fill-current" aria-hidden />}
                  {v.name}
                </button>
              ) : (
                <span className="chip pointer-events-none">
                  {isPrimary(v.id) ? <Star className="w-4 h-4 fill-current text-[var(--color-amber)]" aria-label="Hlavné auto" /> : <Car className="w-4 h-4 muted" aria-hidden />}
                  <span className="font-semibold">{v.name}</span>
                </span>
              )}
              {isAdmin && isOn(v.id) && !isPrimary(v.id) && evVeh.length > 1 && (
                <button type="button" onClick={() => makePrimary(v.id)} className="chip !px-2 muted" title="Nastaviť ako hlavné" aria-label="Nastaviť ako hlavné"><Star className="w-4 h-4" aria-hidden /></button>
              )}
            </span>
          ))}
        </div>
      )}
      {isAdmin && <p className="text-xs muted mt-2">Výber auta pridá jeho sadu techniky. Odobratie auta techniku neodoberie. Hviezdička = hlavné auto.</p>}
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </div>
  )
}

/** Technika na evente. Admin má pri každom kuse − / +, ostatná technika sa pridá cez „Pridať techniku“. */
export function EquipmentGrid({ gear, isAdmin, showAll, onShowAll }: {
  gear: Gear; isAdmin: boolean; showAll: boolean; onShowAll: (v: boolean) => void
}) {
  const { catalog, evEq, setQty } = gear
  const onEvent = new Map(evEq.map((e) => [e.equipment_id, e]))
  // vždy to, čo je na evente; po „Pridať techniku“ aj zvyšok katalógu
  const groups = CATEGORIES.map((cat) => ({
    cat,
    items: catalog.filter((c) => c.category === cat && (onEvent.has(c.id) || (isAdmin && showAll && c.active))),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="grid gap-4">
      {groups.length === 0 && <Empty>Žiadna.</Empty>}
      {groups.map((g) => (
        <div key={g.cat}>
          <h3 className="eyebrow mb-2">{CATEGORY_LABEL[g.cat]}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {g.items.map((c) => {
              const on = onEvent.get(c.id)
              const q = on?.quantity ?? 0
              const [short] = splitName(c.name)
              return (
                <div
                  key={c.id}
                  className={'relative rounded-[var(--ctl-r)] border text-center select-none ' + (q > 0 ? 'border-[var(--color-signal)] bg-[color-mix(in_srgb,var(--color-signal)_8%,transparent)]' : 'line opacity-70')}
                >
                  <div className="pt-4 pb-2 px-1 flex flex-col items-center gap-1.5">
                    <Photo kind="equipment-photos" path={c.photo_path} alt={c.name} className="w-12 h-12 object-cover rounded-[var(--ctl-r)]" fallback={<span className="text-3xl leading-none">{eqIcon(c)}</span>} />
                    <span className="text-xs font-semibold leading-tight line-clamp-2">{short}</span>
                  </div>
                  <span className={'absolute top-1 right-1 badge !h-5 !px-1.5 !text-[10px] num ' + (q > 0 ? 'badge-accent' : '')}>
                    {q}/{c.quantity}
                  </span>
                  {on && on.issue !== 'none' && (
                    <span className="block text-[10px] font-bold text-[var(--danger)] -mt-1 mb-1.5">{ISSUE_LABEL[on.issue]}</span>
                  )}
                  {c.qty_broken > 0 && isAdmin && (
                    <span className="block text-[10px] text-[var(--danger)] -mt-1 mb-1.5">{c.qty_broken} pokaz.</span>
                  )}
                  {isAdmin && (
                    <div className="flex items-center justify-between gap-1 px-1.5 pb-1.5">
                      <button type="button" onClick={() => setQty(c.id, q - 1)} disabled={q === 0} className="btn btn-sm btn-icon" aria-label="Menej"><Minus aria-hidden /></button>
                      <button type="button" onClick={() => setQty(c.id, q + 1)} disabled={q >= Math.max(c.quantity, 1)} className="btn btn-sm btn-icon" aria-label="Viac"><Plus aria-hidden /></button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {isAdmin && (
        <div>
          <button type="button" onClick={() => onShowAll(!showAll)} className="btn btn-sm">
            {showAll ? 'Skryť ostatnú techniku' : <><Plus aria-hidden />Pridať techniku</>}
          </button>
        </div>
      )}
    </div>
  )
}
