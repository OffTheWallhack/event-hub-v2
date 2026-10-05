import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { type Payout, TAX_RATE, withTax } from '../lib/finance'
import { eur } from '../lib/events'

type Driver = { id: string; name: string; is_me: boolean; active: boolean }
type EvDriver = { id: string; driver_id: string; position: number }

/**
 * Vodiči na evente. Pre iného vodiča ako Robert sa zadáva výplata (suma bez dane, +15 % sa pripočíta).
 * Výplaty vidí a mení len admin.
 */
export function EventDrivers({ eventId, isAdmin, onChanged }: { eventId: string; isAdmin: boolean; onChanged: () => void }) {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [evDrivers, setEvDrivers] = useState<EvDriver[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [edit, setEdit] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    Promise.all([
      supabase.from('drivers').select('id, name, is_me, active').order('name'),
      supabase.from('event_drivers').select('id, driver_id, position').eq('event_id', eventId).order('position'),
      isAdmin
        ? supabase.from('driver_payouts').select('id, event_id, driver_id, amount, tax_rate, paid, paid_at, note').eq('event_id', eventId)
        : Promise.resolve({ data: [], error: null }),
    ]).then(([d, ed, p]) => {
      const err = d.error ?? ed.error ?? p.error
      if (err) return setError(err.message)
      setDrivers(d.data as Driver[])
      setEvDrivers(ed.data as EvDriver[])
      const pays = p.data as Payout[]
      setPayouts(pays)
      setAmounts(Object.fromEntries(pays.map((x) => [x.driver_id, String(x.amount)])))
    })
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
      if (p && fail((await supabase.from('driver_payouts').delete().eq('id', p.id)).error)) return
      if (fail((await supabase.from('event_drivers').delete().eq('id', on.id)).error)) return
    } else {
      const pos = evDrivers.reduce((m, x) => Math.max(m, x.position + 1), 0)
      if (fail((await supabase.from('event_drivers').insert({ event_id: eventId, driver_id: d.id, position: pos })).error)) return
    }
    refresh()
  }

  async function savePayout(driverId: string) {
    const raw = (amounts[driverId] ?? '').replace(',', '.').trim()
    const p = payoutOf(driverId)
    if (raw === '') {
      if (p && fail((await supabase.from('driver_payouts').delete().eq('id', p.id)).error)) return
      return refresh()
    }
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount < 0) return setError('Neplatná suma.')
    if (p && Number(p.amount) === amount) return
    const res = p
      ? await supabase.from('driver_payouts').update({ amount }).eq('id', p.id)
      : await supabase.from('driver_payouts').insert({ event_id: eventId, driver_id: driverId, amount, tax_rate: TAX_RATE })
    if (!fail(res.error)) refresh()
  }

  async function togglePaid(p: Payout) {
    const paid = !p.paid
    if (!fail((await supabase.from('driver_payouts').update({ paid, paid_at: paid ? new Date().toISOString() : null }).eq('id', p.id)).error)) refresh()
  }

  async function addDriver() {
    const name = newName.trim()
    if (!name) return
    const { data, error } = await supabase.from('drivers').insert({ name }).select('id, name, is_me, active').single()
    if (fail(error)) return
    setNewName('')
    await toggle(data as Driver)
  }

  const onEvent = evDrivers.map((x) => byId.get(x.driver_id)).filter(Boolean) as Driver[]

  return (
    <Card
      title="Vodiči"
      right={isAdmin && <button onClick={() => setEdit(!edit)} className="h-9 px-3 rounded-lg border line text-sm font-medium">{edit ? 'Hotovo' : 'Upraviť'}</button>}
    >
      {error && <p className="text-[var(--color-signal)] text-sm mb-2">{error}</p>}

      {edit && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {drivers.filter((d) => d.active || evDrivers.some((x) => x.driver_id === d.id)).map((d) => {
              const on = evDrivers.some((x) => x.driver_id === d.id)
              return (
                <button
                  key={d.id}
                  onClick={() => toggle(d)}
                  className={'h-9 px-3 rounded-lg border line text-sm ' + (on ? 'bg-[var(--color-ink)] text-white dark:bg-[var(--color-signal)] font-semibold' : '')}
                >
                  {d.name}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2 mt-2">
            <input className="flex-1 min-w-0 h-9 px-3 rounded-lg border line bg-transparent text-sm" placeholder="Nový vodič – meno" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button onClick={addDriver} disabled={!newName.trim()} className="h-9 px-3 rounded-lg border line text-sm disabled:opacity-50">Pridať</button>
          </div>
        </div>
      )}

      {onEvent.length === 0 ? (
        <p className="muted text-sm">Žiadni.</p>
      ) : (
        <ul className="divide-y line text-sm">
          {onEvent.map((d) => {
            const p = payoutOf(d.id)
            return (
              <li key={d.id} className="py-2 flex items-center gap-2 flex-wrap">
                <span className="font-semibold flex-1 min-w-24">{d.name}{d.is_me && <span className="muted font-normal"> · ja</span>}</span>
                {isAdmin && !d.is_me && (
                  edit ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Výplata €"
                        className={'w-24 h-9 px-2 rounded-lg border bg-transparent text-right ' + (p ? 'line' : 'border-[var(--color-signal)]')}
                        value={amounts[d.id] ?? ''}
                        onChange={(e) => setAmounts((a) => ({ ...a, [d.id]: e.target.value }))}
                        onBlur={() => savePayout(d.id)}
                      />
                      <span className="muted text-xs w-20">{p ? `= ${eur(withTax(p))}` : 'zadaj sumu'}</span>
                    </span>
                  ) : p ? (
                    <>
                      <span className="tabular-nums">{eur(Number(p.amount))} <span className="muted">+ {Math.round(Number(p.tax_rate) * 100)} % = </span><b>{eur(withTax(p))}</b></span>
                      <button
                        onClick={() => togglePaid(p)}
                        className={'h-8 px-2 rounded-lg text-xs font-semibold border ' + (p.paid ? 'border-green-700 text-green-700 dark:border-green-400 dark:text-green-400' : 'border-[var(--color-signal)] text-[var(--color-signal)]')}
                      >
                        {p.paid ? 'Vyplatené' : 'Nevyplatené'}
                      </button>
                    </>
                  ) : (
                    <span className="text-[var(--color-signal)] text-xs font-semibold">chýba výplata</span>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
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
