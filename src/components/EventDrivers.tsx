import { useEffect, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { Badge, Chips, Empty, ErrorText } from './ui'
import { supabase } from '../lib/supabase'
import { type Payout, TAX_RATE, withTax } from '../lib/finance'
import { eur } from '../lib/events'

type Driver = { id: string; name: string; is_me: boolean; active: boolean }
type EvDriver = { id: string; driver_id: string; position: number }

/**
 * Vodiči na evente (vkladá sa do sekcie Vozidlo a vodič). Admin ťuká na mená, výplata sa ukladá sama.
 * Pre iného vodiča ako Robert sa zadáva výplata (suma bez dane, +15 % sa pripočíta). Výplaty vidí a mení len admin.
 */
export function EventDrivers({ eventId, isAdmin, onChanged }: { eventId: string; isAdmin: boolean; onChanged: () => void }) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [evDrivers, setEvDrivers] = useState<EvDriver[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('drivers').select('id, name, is_me, active').order('name'),
      supabase.from('event_drivers').select('id, driver_id, position').eq('event_id', eventId).order('position'),
      isAdmin
        ? supabase.from('driver_payouts').select('id, event_id, driver_id, amount, tax_rate, paid, paid_at, note').eq('event_id', eventId)
        : Promise.resolve({ data: [], error: null }),
    ]).then(([d, ed, p]) => {
      if (!alive) return
      const err = d.error ?? ed.error ?? p.error
      if (err) return setError(err.message)
      setDrivers(d.data as Driver[])
      setEvDrivers(ed.data as EvDriver[])
      const pays = p.data as Payout[]
      setPayouts(pays)
      setAmounts(Object.fromEntries(pays.map((x) => [x.driver_id, String(x.amount)])))
    })
    return () => { alive = false }
  }, [eventId, isAdmin, reload])

  const refresh = () => { setReload((r) => r + 1); onChanged() }
  const fail = (e: { message: string } | null) => { if (e) { setError(e.message); return true } return false }
  const byId = new Map(drivers.map((d) => [d.id, d]))
  const payoutOf = (driverId: string) => payouts.find((p) => p.driver_id === driverId)

  async function toggle(d: Driver) {
    setError(null)
    const on = evDrivers.find((x) => x.driver_id === d.id)
    if (on) {
      const p = payoutOf(d.id)
      if (p && !confirm(`${d.name} má výplatu ${eur(Number(p.amount))}. Odobrať vodiča aj s výplatou?`)) return
      setEvDrivers((l) => l.filter((x) => x.id !== on.id))
      if (p && fail((await supabase.from('driver_payouts').delete().eq('id', p.id)).error)) return refresh()
      if (fail((await supabase.from('event_drivers').delete().eq('id', on.id)).error)) return refresh()
    } else {
      const pos = evDrivers.reduce((m, x) => Math.max(m, x.position + 1), 0)
      if (fail((await supabase.from('event_drivers').insert({ event_id: eventId, driver_id: d.id, position: pos })).error)) return
    }
    refresh()
  }

  async function savePayout(driverId: string, raw0: string) {
    const raw = raw0.replace(',', '.').trim()
    const p = payoutOf(driverId)
    if (raw === '') {
      if (!p) return
      if (fail((await supabase.from('driver_payouts').delete().eq('id', p.id)).error)) return
      return refresh()
    }
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount < 0) return setError('Neplatná suma.')
    if (p && Number(p.amount) === amount) return
    setError(null)
    const res = p
      ? await supabase.from('driver_payouts').update({ amount }).eq('id', p.id)
      : await supabase.from('driver_payouts').insert({ event_id: eventId, driver_id: driverId, amount, tax_rate: TAX_RATE })
    if (!fail(res.error)) refresh()
  }

  async function togglePaid(p: Payout) {
    const paid = !p.paid
    setPayouts((l) => l.map((x) => (x.id === p.id ? { ...x, paid } : x)))
    if (!fail((await supabase.from('driver_payouts').update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq('id', p.id)).error)) refresh()
    else refresh()
  }

  async function addDriver() {
    const name = newName.trim()
    if (!name) return
    const { data, error } = await supabase.from('drivers').insert({ name }).select('id, name, is_me, active').single()
    if (fail(error)) return
    setNewName('')
    setDrivers((l) => [...l, data as Driver])
    await toggle(data as Driver)
  }

  const onEvent = evDrivers.map((x) => byId.get(x.driver_id)).filter(Boolean) as Driver[]

  return (
    <div className="grid gap-3">
      <ErrorText>{error}</ErrorText>

      {isAdmin && (
        <div className="grid gap-2">
          <Chips
            options={drivers.filter((d) => d.active || evDrivers.some((x) => x.driver_id === d.id)).map((d) => [d.id, d.name] as const)}
            isOn={(id) => evDrivers.some((x) => x.driver_id === id)}
            onPick={(id) => { const d = byId.get(id); if (d) toggle(d) }}
          />
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Nový vodič – meno"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addDriver() }}
            />
            <button onClick={addDriver} disabled={!newName.trim()} className="btn"><Plus aria-hidden />Pridať</button>
          </div>
        </div>
      )}

      {onEvent.length === 0 ? (
        <Empty>Žiadni vodiči.</Empty>
      ) : (
        <ul className="list text-sm">
          {onEvent.map((d) => {
            const p = payoutOf(d.id)
            return (
              <li key={d.id} className="row flex-wrap">
                <span className="font-semibold flex-1 min-w-24">{d.name}{d.is_me && <span className="muted font-normal"> · ja</span>}</span>
                {isAdmin && !d.is_me && (
                  <>
                    <span className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Výplata €"
                        className={'input !w-28 !h-10 text-right ' + (p ? '' : '!border-[var(--danger)]')}
                        value={amounts[d.id] ?? ''}
                        onChange={(e) => setAmounts((a) => ({ ...a, [d.id]: e.target.value }))}
                        onBlur={(e) => savePayout(d.id, e.target.value)}
                      />
                      <span className="muted text-xs w-24">{p ? `+ ${Math.round(Number(p.tax_rate) * 100)} % = ${eur(withTax(p))}` : 'zadaj sumu'}</span>
                    </span>
                    {p ? (
                      <button onClick={() => togglePaid(p)} className={'badge ' + (p.paid ? 'badge-ok' : 'badge-danger') + ' !h-8 !px-2.5'} title="Prepnúť vyplatené / nevyplatené">
                        {p.paid ? <Check className="w-3.5 h-3.5" aria-hidden /> : null}{p.paid ? 'Vyplatené' : 'Nevyplatené'}
                      </button>
                    ) : (
                      <Badge tone="danger">chýba výplata</Badge>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
