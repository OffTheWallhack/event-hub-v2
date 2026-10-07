import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { EventRow } from '../lib/events'

type Line = {
  equipment_id: string
  quantity: number
  returned_confirmed: boolean
  issue: 'none' | 'broken' | 'not_returned'
  equipment: { name: string; quantity: number; status: string; status_event_id: string | null } | null
}
type Mark = 'ok' | 'broken' | 'not_returned'

/**
 * Report po evente (admin): kontrola kartónov a techniky, diváci, hodnotenie, text.
 * Technika označená ako pokazená / nevrátená si zapamätá event (status_event_id) a ukáže sa v Technike.
 */
export function EventReport({ ev, cartons, onChanged }: {
  ev: EventRow
  cartons: { label: string; n: number }[]
  onChanged: () => void
}) {
  const [lines, setLines] = useState<Line[]>([])
  const [f, setF] = useState({
    spectators: ev.spectators?.toString() ?? '',
    rating: ev.rating ?? 0,
    report: ev.report ?? '',
    played: ev.played_as_dj,
  })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    supabase
      .from('event_equipment')
      .select('equipment_id, quantity, returned_confirmed, issue, equipment(name, quantity, status, status_event_id)')
      .eq('event_id', ev.id)
      .then(({ data }) => setLines(((data ?? []) as unknown as Line[]).sort((a, b) => (a.equipment?.name ?? '').localeCompare(b.equipment?.name ?? ''))))
  }, [ev.id, reload])

  const fail = (e: { message: string } | null) => { if (e) { setError(e.message); return true } return false }

  async function mark(l: Line, kind: Mark) {
    setError(null)
    setMsg(null)
    const eq = l.equipment
    if (!eq) return
    const single = eq.quantity === 1
    const note = (txt: string) => `${txt}: ${ev.title}`

    const evPatch =
      kind === 'ok' ? { returned_confirmed: true, returned_at: new Date().toISOString(), issue: 'none' }
      : kind === 'broken' ? { returned_confirmed: true, returned_at: new Date().toISOString(), issue: 'broken' }
      : { returned_confirmed: false, returned_at: null, issue: 'not_returned' }
    if (fail((await supabase.from('event_equipment').update(evPatch).eq('event_id', ev.id).eq('equipment_id', l.equipment_id)).error)) return

    // kus techniky: pokazený / nevrátený sa zapíše aj do katalógu (s odkazom na event)
    let eqPatch: Record<string, unknown> | null = null
    if (kind === 'ok') {
      if (eq.status_event_id === ev.id) eqPatch = { status: 'ok', status_event_id: null, status_note: null, ...(single ? { qty_broken: 0, qty_borrowed: 0 } : {}) }
    } else if (kind === 'broken') {
      eqPatch = single
        ? { status: 'broken', qty_broken: 1, status_event_id: ev.id, status_note: note('Pokazené na evente') }
        : { status_event_id: ev.id, status_note: note('Pokazené kusy na evente') }
    } else {
      eqPatch = single
        ? { status: 'borrowed', qty_borrowed: 1, status_event_id: ev.id, status_note: note('Nevrátené z eventu') }
        : { status_event_id: ev.id, status_note: note('Nevrátené kusy z eventu') }
    }
    if (eqPatch && fail((await supabase.from('equipment').update(eqPatch).eq('id', l.equipment_id)).error)) return
    if (kind !== 'ok' && !single) setMsg(`${eq.name}: počet pokazených / nevrátených kusov uprav v Technike.`)
    setReload((r) => r + 1)
  }

  async function save(close: boolean) {
    setBusy(true)
    setError(null)
    const sp = f.spectators.trim() === '' ? null : Number(f.spectators)
    if (sp !== null && (!Number.isFinite(sp) || sp < 0)) { setBusy(false); return setError('Neplatný počet divákov.') }
    const { error } = await supabase
      .from('events')
      .update({
        spectators: sp,
        rating: f.rating || null,
        report: f.report.trim() || null,
        played_as_dj: f.played,
        ...(close ? { status: 'done' } : {}),
      })
      .eq('id', ev.id)
    setBusy(false)
    if (fail(error)) return
    setMsg(close ? 'Report uložený, event je Hotový.' : 'Report uložený.')
    onChanged()
  }

  const unresolved = lines.filter((l) => !l.returned_confirmed && l.issue === 'none').length
  const checks = [
    { ok: cartons.length > 0, text: cartons.length > 0 ? `Kartóny: ${cartons.map((c) => `${c.n}× ${c.label}`).join(', ')}` : 'Kartóny: nič nezapísané' },
    { ok: lines.length > 0 && unresolved === 0, text: lines.length === 0 ? 'Technika: nič nezapísané' : unresolved === 0 ? 'Technika: všetko skontrolované' : `Technika: ${unresolved} ks čaká na kontrolu` },
    { ok: f.spectators.trim() !== '', text: f.spectators.trim() !== '' ? `Diváci: ${f.spectators}` : 'Diváci: chýba' },
    { ok: f.rating > 0, text: f.rating > 0 ? `Hodnotenie: ${f.rating}/5` : 'Hodnotenie: chýba' },
  ]

  const input = 'w-full h-11 px-3 rounded-lg border line bg-transparent'
  return (
    <div className="card p-4 min-w-0">
      <h2 className="display text-xl font-bold mb-2">Report po evente</h2>

      <ul className="grid gap-1 text-sm mb-4">
        {checks.map((c) => (
          <li key={c.text} className="flex gap-2"><span className={c.ok ? 'text-green-700 dark:text-green-400' : 'text-[var(--color-amber)]'}>{c.ok ? '✓' : '⚠'}</span><span>{c.text}</span></li>
        ))}
      </ul>

      {lines.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider muted mb-1">Technika – vrátená?</h3>
          <ul className="divide-y line text-sm">
            {lines.map((l) => (
              <li key={l.equipment_id} className="py-2">
                <p className="font-medium">{l.quantity}× {l.equipment?.name}</p>
                <div className="flex gap-1 mt-1">
                  {([['ok', 'Vrátené ✓'], ['broken', 'Pokazené'], ['not_returned', 'Nevrátené']] as const).map(([k, label]) => {
                    const on = k === 'ok' ? l.returned_confirmed && l.issue === 'none' : l.issue === k
                    return (
                      <button
                        key={k}
                        onClick={() => mark(l, k)}
                        className={'h-9 px-3 rounded-lg border text-xs font-semibold ' + (on ? (k === 'ok' ? 'bg-green-700 border-green-700 text-white' : 'bg-[var(--color-signal)] border-[var(--color-signal)] text-white') : 'line')}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs muted mt-1">Pokazené a nevrátené kusy sa zapíšu aj do <Link to="/technika" className="text-[var(--color-sky)]">Techniky</Link> s odkazom na tento event.</p>
        </div>
      )}

      <div className="grid gap-4">
        <label className="grid gap-1 text-sm"><span className="muted">Diváci</span>
          <input type="number" inputMode="numeric" min={0} className={input} value={f.spectators} onChange={(e) => setF({ ...f, spectators: e.target.value })} /></label>

        <div className="grid gap-1 text-sm">
          <span className="muted">Hodnotenie</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Hodnotenie">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setF({ ...f, rating: f.rating === n ? 0 : n })}
                className={'w-12 h-12 text-3xl leading-none ' + (n <= f.rating ? 'text-[var(--color-amber)]' : 'text-[var(--line)]')}
                aria-label={`${n} z 5`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-1 text-sm"><span className="muted">Ako to dopadlo (text)</span>
          <textarea rows={4} className={input + ' h-auto py-2'} value={f.report} onChange={(e) => setF({ ...f, report: e.target.value })} /></label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.played} onChange={(e) => setF({ ...f, played: e.target.checked })} />
          Hral som ako DJ
        </label>

        {error && <p className="text-[var(--color-signal)] text-sm">{error}</p>}
        {msg && <p className="text-sm">{msg}</p>}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => save(false)} disabled={busy} className="h-11 px-5 rounded-lg border line font-semibold disabled:opacity-60">Uložiť</button>
          {ev.status !== 'done' && (
            <button onClick={() => save(true)} disabled={busy} className="h-11 px-5 rounded-lg font-semibold text-white bg-[var(--color-signal)] disabled:opacity-60">Uložiť a uzavrieť event</button>
          )}
        </div>
      </div>
    </div>
  )
}
