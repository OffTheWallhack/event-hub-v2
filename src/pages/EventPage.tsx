import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CalendarDays, Car, Check, ChevronLeft, CircleCheck, ExternalLink, FileText, MapPin, Plus, TriangleAlert } from 'lucide-react'
import { Badge, Chips, Empty, ErrorText, Field, KV, Section, Seg, dayWord, linkify } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { EquipmentGrid, VehicleChips, useEventGear } from '../components/EventGear'
import { EventDrivers } from '../components/EventDrivers'
import { EventCartons, type EventCartonRow } from '../components/EventCartons'
import { LiveField } from '../components/LiveField'
import { BriefShare } from '../components/BriefShare'
import { EventReport } from '../components/EventReport'
import { EventNavBar } from '../components/EventNavBar'
import { ExpenseForm } from '../components/ExpenseForm'
import { type Expense, DOC_LABEL, EXPENSE_COLUMNS } from '../lib/finance'
import { missingOf } from '../lib/complete'
import {
  type Department, type EventRow, type EventStatus, type EventType,
  DEPT_LABEL, STATUS_LABEL, TYPE_COLOR, TYPE_LABEL, TYPE_TEXT,
  durationDays, eur, fmtDay, fmtDrive, fmtRange, mapUrl, relDay, startDay, todayLocal,
} from '../lib/events'

type Carton = EventCartonRow & { flavors: { name: string; label: string | null; sort_order: number } | null }
type Payout = { id: string; driver_id: string; amount: number; tax_rate: number; paid: boolean; drivers: { name: string } | null }

type EvDrv = { driver_id: string; drivers: { is_me: boolean } | null }
type Details = { cartons: Carton[]; expenses: Expense[]; payouts: Payout[]; evDrivers: EvDrv[] }

// polia eventu, ktoré sa dajú meniť priamo na stránke (Basecamp polia sa menia len synchronizáciou)
type Editable = Pick<EventRow, 'status' | 'event_type' | 'departments' | 'location' | 'location_url' | 'planned_arrival' | 'contact' | 'spectators' | 'description'>
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const STATUSES: EventStatus[] = ['planned', 'done', 'cancelled']
const TYPES: EventType[] = ['event_car', 'support', 'adhoc', 'servis']
const DEPTS: Department[] = ['ec', 'culture', 'sport', 'onpremise']
const nn = (s: string) => (s.trim() === '' ? null : s.trim())

export function EventPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const { isAdmin } = useAuth()
  const [ev, setEv] = useState<EventRow | null>(null)
  const [d, setD] = useState<Details | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expenseForm, setExpenseForm] = useState<Expense | 'new' | null>(null)
  const [showAllGear, setShowAllGear] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const gear = useEventGear(id)
  const savedTimer = useRef<number | undefined>(undefined)

  async function load() {
    const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
    if (error) return setError(error.message)
    if (!data) return setError('Event sa nenašiel.')
    setEv(data as EventRow)

    const [ct, ex, po, ed] = await Promise.all([
      supabase.from('carton_movements').select('id, flavor_id, cartons, flavors(name, label, sort_order)').eq('event_id', id).eq('type', 'event'),
      isAdmin
        ? supabase.from('expenses').select(EXPENSE_COLUMNS).eq('event_id', id).order('date')
        : Promise.resolve({ data: [] }),
      isAdmin
        ? supabase.from('driver_payouts').select('id, driver_id, amount, tax_rate, paid, drivers(name)').eq('event_id', id)
        : Promise.resolve({ data: [] }),
      supabase.from('event_drivers').select('driver_id, drivers(is_me)').eq('event_id', id),
    ])
    setD({
      cartons: (ct.data ?? []) as unknown as Carton[],
      expenses: (ex.data ?? []) as unknown as Expense[],
      payouts: (po.data ?? []) as unknown as Payout[],
      evDrivers: (ed.data ?? []) as unknown as EvDrv[],
    })
  }
  useEffect(() => {
    setExpenseForm(null); setShowAllGear(false); setD(null); setSaveState('idle'); setSaveError(null)
    load()
  }, [id, isAdmin])

  // Trasa z Bratislavy: spočíta sa sama, keď sa zmení lokalita (len admin).
  const routeTried = useRef('')
  useEffect(() => {
    if (!isAdmin || !ev || ev.id !== id) return
    const place = ev.location?.trim() ?? ''
    if ((ev.route_for ?? '') === place) return
    const key = id + '|' + place
    if (routeTried.current === key) return
    routeTried.current = key
    supabase.functions.invoke('route', { body: { event_id: id } }).then(({ error }) => { if (!error) load() })
  }, [isAdmin, id, ev?.id, ev?.location, ev?.route_for])

  /** Uloží zmenu poľa eventu hneď. Stránka sa prekreslí ešte pred odpoveďou servera, pri chybe sa načíta pôvodný stav. */
  async function patch(p: Partial<Editable>) {
    const evId = id
    setEv((e) => (e && e.id === evId ? { ...e, ...p } : e))
    setSaveState('saving'); setSaveError(null)
    window.clearTimeout(savedTimer.current)
    const { error } = await supabase.from('events').update(p).eq('id', evId)
    if (error) {
      setSaveState('error'); setSaveError(error.message)
      load()
    } else {
      setSaveState('saved')
      savedTimer.current = window.setTimeout(() => setSaveState('idle'), 2000)
    }
  }

  if (error) return <p className="err">{error}</p>
  if (!ev || !d) {
    return (
      <div className="page">
        {ev && <EventNavBar ev={ev} />}
        <p className="muted">Načítavam…</p>
      </div>
    )
  }

  const expSum = d.expenses.reduce((s, e) => s + Number(e.amount), 0)
  const payWithTax = (p: Payout) => Number(p.amount) * (1 + Number(p.tax_rate))
  const paySum = d.payouts.reduce((s, p) => s + payWithTax(p), 0)

  // kartóny po príchutiach pre report (pohyby typu event sú záporné)
  const cartonMap = new Map<string, { label: string; n: number; order: number }>()
  for (const c of d.cartons) {
    const key = c.flavors?.name ?? '?'
    const cur = cartonMap.get(key) ?? { label: c.flavors?.label || key, n: 0, order: c.flavors?.sort_order ?? 0 }
    cur.n += -c.cartons
    cartonMap.set(key, cur)
  }
  const cartons = [...cartonMap.values()].filter((c) => c.n !== 0).sort((a, b) => a.order - b.order)
  const statusTone = ev.status === 'done' ? 'ok' : ev.status === 'cancelled' ? 'danger' : 'neutral'
  const rel = relDay(ev)
  const map = mapUrl(ev)
  const totalPieces = gear.evEq.reduce((s, e) => s + e.quantity, 0)
  const paidIds = new Set(d.payouts.map((p) => p.driver_id))
  const missing = isAdmin
    ? missingOf(ev, {
        drivers: d.evDrivers.length,
        externalWithoutPayout: d.evDrivers.filter((x) => !x.drivers?.is_me && !paidIds.has(x.driver_id)).length,
        cartons: cartons.length,
        gear: gear.evEq.length,
      }, todayLocal())
    : []
  const routeOk = ev.route_km != null && ev.route_min != null && (ev.route_for ?? '') === (ev.location?.trim() ?? '')

  return (
    <div className="page">
      <EventNavBar ev={ev} />
      <div>
        <Link to="/" search={{ m: startDay(ev).slice(0, 7) }} className="btn btn-sm btn-quiet -ml-3"><ChevronLeft aria-hidden />Kalendár</Link>
      </div>

      {/* Hlavička: čo prišlo z Basecampu (mení ho len synchronizácia) */}
      <header className="card section">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="badge" style={{ background: TYPE_COLOR[ev.event_type], color: TYPE_TEXT[ev.event_type] }}>{TYPE_LABEL[ev.event_type]}</span>
          <Badge tone={statusTone}>{STATUS_LABEL[ev.status]}</Badge>
          {ev.departments.map((dp) => <Badge key={dp}>{DEPT_LABEL[dp]}</Badge>)}
          {isAdmin && <SaveIndicator state={saveState} />}
        </div>
        <h1 className={'page-title !text-[1.75rem] mt-3 ' + (ev.status === 'cancelled' ? 'line-through opacity-60' : '')}>{ev.title}</h1>
        <p className="mt-2 flex items-start gap-2 font-medium">
          <CalendarDays className="w-4 h-4 muted shrink-0 mt-[0.2em]" aria-hidden />
          <span>
            <b className="text-[var(--link)]">{rel.charAt(0).toUpperCase() + rel.slice(1)}</b>
            <span className="muted font-normal"> · </span>
            {fmtRange(ev)} <span className="muted font-normal whitespace-nowrap">· {durationDays(ev)} {dayWord(durationDays(ev))}</span>
          </span>
        </p>
        {ev.deleted_from_basecamp && <p className="err font-semibold mt-2">Event zmizol z Basecampu.</p>}
        {(ev.basecamp_notes || ev.basecamp_url) && (
          <div className="mt-4 rounded-[var(--ctl-r)] bg-[var(--fill)] p-3">
            {ev.basecamp_notes && <Clamp key={ev.id}>{linkify(ev.basecamp_notes)}</Clamp>}
            {ev.basecamp_url && (
              <a href={ev.basecamp_url} target="_blank" rel="noreferrer" className={'link text-sm flex items-center gap-1 w-fit ' + (ev.basecamp_notes ? 'mt-2' : '')}>
                Otvoriť v Basecampe<ExternalLink className="w-3.5 h-3.5" aria-hidden />
              </a>
            )}
          </div>
        )}
        {saveError && <div className="mt-2"><ErrorText>{saveError}</ErrorText></div>}
      </header>

      {/* Čo ešte chýba (len admin) */}
      {isAdmin && ev.status !== 'cancelled' && (
        missing.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ok)]"><CircleCheck className="w-5 h-5" aria-hidden />Event je kompletný</p>
        ) : (
          <div className="notice flex items-start gap-2">
            <TriangleAlert className="w-5 h-5 text-[var(--warn)] shrink-0" aria-hidden />
            <p className="text-sm"><b>Čo chýba:</b> {missing.join(', ')}</p>
          </div>
        )
      )}

      {/* 1. Vozidlo a vodič */}
      <Section title="Vozidlo a vodič">
        <div className="grid gap-5">
          <div>
            <p className="field-label mb-1.5">Vozidlo</p>
            <VehicleChips gear={gear} isAdmin={isAdmin} />
          </div>
          <div>
            <p className="field-label mb-1.5">Vodič</p>
            <EventDrivers eventId={ev.id} isAdmin={isAdmin} onChanged={load} />
          </div>
        </div>
      </Section>

      {/* 2. Logistika */}
      {isAdmin ? (
        <Section title="Logistika">
          <div className="form">
            <div className="field"><span className="field-label">Stav</span>
              <Seg options={STATUSES.map((s) => [s, STATUS_LABEL[s]] as const)} value={ev.status} onChange={(s) => patch({ status: s })} /></div>
            <div className="field"><span className="field-label">Typ</span>
              <Chips options={TYPES.map((t) => [t, TYPE_LABEL[t]] as const)} isOn={(t) => ev.event_type === t} onPick={(t) => patch({ event_type: t })} /></div>
            <div className="field"><span className="field-label">Oddelenie (aj viac)</span>
              <Chips
                options={DEPTS.map((dp) => [dp, DEPT_LABEL[dp]] as const)}
                isOn={(dp) => ev.departments.includes(dp)}
                onPick={(dp) => patch({ departments: ev.departments.includes(dp) ? ev.departments.filter((x) => x !== dp) : [...ev.departments, dp] })}
              /></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Čas príchodu">
                <LiveField type="time" value={ev.planned_arrival?.slice(0, 5) ?? ''} delay={400} onSave={(v) => patch({ planned_arrival: nn(v) })} />
              </Field>
              <Field label="Diváci">
                <LiveField type="number" inputMode="numeric" min={0} value={ev.spectators?.toString() ?? ''} onSave={(v) => patch({ spectators: v.trim() === '' ? null : Math.max(0, Math.trunc(Number(v)) || 0) })} />
              </Field>
            </div>
            <div className="field">
              <span className="field-label">Lokalita</span>
              <LiveField value={ev.location ?? ''} placeholder="Napíš miesto, mapa sa nájde sama" onSave={(v) => patch({ location: nn(v) })} />
              {map ? (
                <a href={map} target="_blank" rel="noreferrer" className="link text-sm inline-flex items-center gap-1 justify-self-start">
                  <MapPin className="w-4 h-4" aria-hidden />Otvoriť na mape<ExternalLink className="w-3.5 h-3.5" aria-hidden />
                </a>
              ) : (
                <span className="text-xs muted">Po zadaní lokality sa tu ukáže odkaz na mapu.</span>
              )}
              {routeOk && (
                <span className="text-sm inline-flex items-center gap-1.5">
                  <Car className="w-4 h-4 muted" aria-hidden />
                  <b className="num">≈ {Math.round(Number(ev.route_km))} km</b><span className="muted">· {fmtDrive(Number(ev.route_min))} z Bratislavy</span>
                </span>
              )}
            </div>
            <Field label="Vlastný odkaz na mapu (nepovinné)" hint="Nechaj prázdne – odkaz sa nájde automaticky podľa lokality.">
              <LiveField type="url" inputMode="url" value={ev.location_url ?? ''} placeholder="https://maps.google.com/…" onSave={(v) => patch({ location_url: nn(v) })} />
            </Field>
            <Field label="Kontakt"><LiveField multiline rows={2} value={ev.contact ?? ''} onSave={(v) => patch({ contact: nn(v) })} /></Field>
            <Field label="Popis práce"><LiveField multiline rows={3} value={ev.description ?? ''} onSave={(v) => patch({ description: nn(v) })} /></Field>
          </div>
        </Section>
      ) : (
        <Section title="Logistika">
          <dl className="kv">
            <KV label="Príchod">{ev.planned_arrival?.slice(0, 5)}</KV>
            <KV label="Lokalita">
              {ev.location}
              {map && (
                <a href={map} target="_blank" rel="noreferrer" className="link ml-2 inline-flex items-center gap-0.5">
                  <MapPin className="w-3.5 h-3.5" aria-hidden />Mapa
                </a>
              )}
            </KV>
            {routeOk && <KV label="Cesta">≈ {Math.round(Number(ev.route_km))} km · {fmtDrive(Number(ev.route_min))} z Bratislavy</KV>}
            <KV label="Kontakt">{ev.contact && <span className="whitespace-pre-wrap">{linkify(ev.contact)}</span>}</KV>
            <KV label="Diváci">{ev.spectators}</KV>
            <KV label="Popis">{ev.description && <span className="whitespace-pre-wrap">{ev.description}</span>}</KV>
          </dl>
        </Section>
      )}

      {/* 3. Technika */}
      <Section title={<>Technika{totalPieces ? <span className="muted font-normal"> · {totalPieces} ks</span> : ''}</>}>
        <EquipmentGrid gear={gear} isAdmin={isAdmin} showAll={showAllGear} onShowAll={setShowAllGear} />
      </Section>

      {/* 4. Kartóny */}
      <Section title="Kartóny">
        <EventCartons eventId={ev.id} day={startDay(ev)} isAdmin={isAdmin} rows={d.cartons} onChanged={load} />
      </Section>

      {/* 5. Náklady */}
      {isAdmin && (
        <Section
          title="Náklady"
          action={
            <>
              <span className="stat-value !text-xl">{eur(expSum + paySum)}</span>
              {!expenseForm && <button onClick={() => setExpenseForm('new')} className="btn btn-sm"><Plus aria-hidden />Účet</button>}
            </>
          }
        >
          {expenseForm ? (
            <ExpenseForm
              expense={expenseForm === 'new' ? undefined : expenseForm}
              fixedEventId={ev.id}
              defaultDay={startDay(ev)}
              onDone={(saved) => { setExpenseForm(null); if (saved) load() }}
            />
          ) : d.expenses.length === 0 && d.payouts.length === 0 ? (
            <Empty>{ev.no_expenses ? 'Bez nákladov.' : 'Zatiaľ žiadne účty.'}</Empty>
          ) : (
            <ul className="list text-sm">
              {d.expenses.map((e) => (
                <li key={e.id} className="row">
                  <span className="muted w-12 shrink-0 num whitespace-nowrap">{fmtDay(e.date).replace(/ \d{4}$/, '')}</span>
                  <button onClick={() => setExpenseForm(e)} className="flex-1 min-w-0 truncate text-left">
                    {(e.doc_type && DOC_LABEL[e.doc_type]) ?? 'Doklad'}{e.description ? <span className="muted"> · {e.description}</span> : ''}
                  </button>
                  {e.drive_file_url && <a href={e.drive_file_url} target="_blank" rel="noreferrer" className="link" title="Doklad v Drive"><FileText className="w-4 h-4" aria-hidden /></a>}
                  <span className="font-semibold num">{eur(Number(e.amount))}</span>
                </li>
              ))}
              {d.payouts.map((p) => (
                <li key={p.id} className="row">
                  <span className="muted w-12 shrink-0">Výplata</span>
                  <span className="flex-1 min-w-0 truncate">
                    {p.drivers?.name ?? '?'} <span className="muted">· {eur(Number(p.amount))} + {Math.round(Number(p.tax_rate) * 100)} %</span>
                  </span>
                  <Badge tone={p.paid ? 'ok' : 'danger'}>{p.paid ? 'vyplatené' : 'nevyplatené'}</Badge>
                  <span className="font-semibold num">{eur(payWithTax(p))}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* 6. Pošli vodičovi */}
      {isAdmin && <BriefShare ev={ev} />}

      {isAdmin && <EventReport key={ev.id + ev.status} ev={ev} cartons={cartons.map((c) => ({ label: c.label, n: c.n }))} onChanged={load} />}

      {!isAdmin && (ev.rating || ev.report) && (
        <Section title="Report">
          {ev.rating && <p className="text-lg text-[var(--color-amber)]">{'★'.repeat(ev.rating)}<span className="opacity-25">{'★'.repeat(5 - ev.rating)}</span></p>}
          {ev.report && <p className="text-sm whitespace-pre-wrap mt-1">{ev.report}</p>}
        </Section>
      )}
    </div>
  )
}

/** Dlhý text z Basecampu: ukáže ~4 riadky a tlačidlo „Zobraziť viac“ (len ak sa naozaj niečo skrýva). */
function Clamp({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [over, setOver] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && !open) setOver(el.scrollHeight > el.clientHeight + 1)
  }, [children, open])
  return (
    <>
      <p ref={ref} className={'text-sm whitespace-pre-wrap break-words ' + (open ? '' : 'line-clamp-4')}>{children}</p>
      {(over || open) && (
        <button type="button" onClick={() => setOpen(!open)} className="link text-sm mt-1 block">{open ? 'Zobraziť menej' : 'Zobraziť viac'}</button>
      )}
    </>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  return (
    <span className={'ml-auto text-xs inline-flex items-center gap-1 ' + (state === 'error' ? 'err' : 'muted')} role="status">
      {state === 'saved' && <Check className="w-3.5 h-3.5" aria-hidden />}
      {state === 'saving' ? 'Ukladám…' : state === 'saved' ? 'Uložené' : 'Nepodarilo sa uložiť'}
    </span>
  )
}
