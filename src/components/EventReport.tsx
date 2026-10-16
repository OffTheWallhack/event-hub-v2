import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CircleAlert, CircleCheck, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ErrorText, Field, Section, Seg } from './ui'
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

  return (
    <Section title="Report po evente">
      <ul className="grid gap-1.5 text-sm mb-5">
        {checks.map((c) => (
          <li key={c.text} className="flex items-start gap-2">
            {c.ok ? <CircleCheck className="w-4.5 h-4.5 mt-px shrink-0 text-[var(--ok)]" aria-hidden /> : <CircleAlert className="w-4.5 h-4.5 mt-px shrink-0 text-[var(--warn)]" aria-hidden />}
            <span>{c.text}</span>
          </li>
        ))}
      </ul>

      {lines.length > 0 && (
        <div className="mb-5">
          <h3 className="eyebrow mb-1">Technika – vrátená?</h3>
          <ul className="list text-sm">
            {lines.map((l) => (
              <li key={l.equipment_id} className="py-2.5 grid gap-2">
                <p className="font-medium">{l.quantity}× {l.equipment?.name}</p>
                <Seg
                  options={[['ok', 'Vrátené'], ['broken', 'Pokazené'], ['not_returned', 'Nevrátené']] as const}
                  value={(l.returned_confirmed && l.issue === 'none' ? 'ok' : l.issue === 'none' ? '' : l.issue) as Mark}
                  onChange={(k) => mark(l, k)}
                />
              </li>
            ))}
          </ul>
          <p className="text-xs muted mt-2">Pokazené a nevrátené kusy sa zapíšu aj do <Link to="/technika" className="link">Techniky</Link> s odkazom na tento event.</p>
        </div>
      )}

      <div className="form">
        <div className="grid grid-cols-2 gap-3 items-end">
          <Field label="Diváci">
            <input type="number" inputMode="numeric" min={0} className="input" value={f.spectators} onChange={(e) => setF({ ...f, spectators: e.target.value })} />
          </Field>
          <label className="check pb-1.5">
            <input type="checkbox" checked={f.played} onChange={(e) => setF({ ...f, played: e.target.checked })} />
            Hral som ako DJ
          </label>
        </div>

        <div className="field">
          <span className="field-label">Hodnotenie</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Hodnotenie">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setF({ ...f, rating: f.rating === n ? 0 : n })}
                className={'w-11 h-11 grid place-items-center ' + (n <= f.rating ? 'text-[var(--color-amber)]' : 'muted opacity-40')}
                aria-label={`${n} z 5`}
              >
                <Star className={'w-8 h-8 ' + (n <= f.rating ? 'fill-current' : '')} aria-hidden />
              </button>
            ))}
          </div>
        </div>

        <Field label="Ako to dopadlo">
          <textarea rows={4} className="input" value={f.report} onChange={(e) => setF({ ...f, report: e.target.value })} />
        </Field>

        <ErrorText>{error}</ErrorText>
        {msg && <p className="text-sm">{msg}</p>}
        <div className="form-actions">
          <button onClick={() => save(false)} disabled={busy} className="btn">Uložiť</button>
          {ev.status !== 'done' && (
            <button onClick={() => save(true)} disabled={busy} className="btn btn-primary">Uložiť a uzavrieť event</button>
          )}
        </div>
      </div>
    </Section>
  )
}
