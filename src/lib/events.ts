// Spoločné typy a pomocné funkcie pre eventy.
// Dátumy eventov sú celé dni uložené ako YYYY-MM-DDT00:00Z, pracujeme s reťazcom YYYY-MM-DD.

export type EventStatus = 'planned' | 'done' | 'cancelled'
export type EventType = 'event_car' | 'support' | 'adhoc' | 'servis'
export type Department = 'ec' | 'culture' | 'sport' | 'onpremise'

export type EventRow = {
  id: string
  ical_uid: string | null
  title: string
  start_date: string
  end_date: string | null
  basecamp_notes: string | null
  basecamp_url: string | null
  deleted_from_basecamp: boolean
  status: EventStatus
  event_type: EventType
  departments: Department[]
  location: string | null
  location_url: string | null
  spectators: number | null
  planned_arrival: string | null
  contact: string | null
  description: string | null
  report: string | null
  rating: number | null
  no_expenses: boolean
  played_as_dj: boolean
  route_km: number | null
  route_min: number | null
  route_for: string | null
}

export const TYPE_LABEL: Record<EventType, string> = {
  event_car: 'Event Car',
  support: 'Support',
  adhoc: 'Adhoc',
  servis: 'Servis',
}
export const TYPE_COLOR: Record<EventType, string> = {
  event_car: 'var(--color-signal)',
  support: 'var(--color-amber)',
  adhoc: 'var(--color-sky)',
  servis: 'var(--color-sun)',
}
export const TYPE_TEXT: Record<EventType, string> = {
  event_car: 'var(--on-accent, #fff)',
  support: '#1a1205',
  adhoc: '#fff',
  servis: '#1a1505',
}
export const STATUS_LABEL: Record<EventStatus, string> = {
  planned: 'Plánovaný',
  done: 'Hotový',
  cancelled: 'Zrušený',
}
export const DEPT_LABEL: Record<Department, string> = {
  ec: 'EC',
  culture: 'Culture',
  sport: 'Sport',
  onpremise: 'On-premise',
}

export const dayOf = (iso: string | null | undefined) => (iso ?? '').slice(0, 10)
export const startDay = (e: Pick<EventRow, 'start_date'>) => dayOf(e.start_date)
export const endDay = (e: Pick<EventRow, 'start_date' | 'end_date'>) => {
  const s = dayOf(e.start_date)
  const en = dayOf(e.end_date)
  return en && en >= s ? en : s
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
}
export const durationDays = (e: Pick<EventRow, 'start_date' | 'end_date'>) => diffDays(startDay(e), endDay(e)) + 1

export function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MONTHS = ['január', 'február', 'marec', 'apríl', 'máj', 'jún', 'júl', 'august', 'september', 'október', 'november', 'december']
export const monthName = (m: number) => MONTHS[m]

export function fmtDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}
export function fmtRange(e: Pick<EventRow, 'start_date' | 'end_date'>): string {
  const s = startDay(e)
  const en = endDay(e)
  return s === en ? fmtDay(s) : `${fmtDay(s)} – ${fmtDay(en)}`
}

// Slovenské skloňovanie: 1 mesiac, 2–4 mesiace, 5+ mesiacov (a rovnako pre roky)
const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

/**
 * Kedy to je od dnešného dňa: dnes, zajtra, pozajtra, o 3 dni, o 10 dní, o 2 mesiace…
 * a do minulosti: včera, predvčerom, pred 3 dňami, pred mesiacom, pred 2 mesiacmi…
 * Viacdňový event, ktorý práve beží, je „dnes“ (ak sa začal skôr, „prebieha“).
 */
export function relDay(e: Pick<EventRow, 'start_date' | 'end_date'>, today: string = todayLocal()): string {
  const s = diffDays(today, startDay(e))
  const en = diffDays(today, endDay(e))
  if (s <= 0 && en >= 0) return s === 0 ? 'dnes' : 'prebieha'
  const n = s > 0 ? s : en // vzdialenosť od najbližšieho konca (v dňoch, kladné = budúcnosť)
  const abs = Math.abs(n)
  if (abs === 1) return n > 0 ? 'zajtra' : 'včera'
  if (abs === 2) return n > 0 ? 'pozajtra' : 'predvčerom'
  if (abs < 30) return n > 0 ? `o ${abs} ${abs < 5 ? 'dni' : 'dní'}` : `pred ${abs} dňami`
  const months = Math.round(abs / 30.4375)
  if (months < 12) {
    return n > 0
      ? (months === 1 ? 'o mesiac' : `o ${months} ${plural(months, 'mesiac', 'mesiace', 'mesiacov')}`)
      : (months === 1 ? 'pred mesiacom' : `pred ${months} mesiacmi`)
  }
  const years = Math.floor(months / 12)
  return n > 0
    ? (years === 1 ? 'o rok' : `o ${years} ${plural(years, 'rok', 'roky', 'rokov')}`)
    : (years === 1 ? 'pred rokom' : `pred ${years} rokmi`)
}

/** Odkaz na miesto na mape: vlastný odkaz, ak je zadaný, inak Google Maps nájde prvý výsledok pre text z poľa Lokalita. */
export function mapUrl(e: Pick<EventRow, 'location' | 'location_url'>): string | null {
  const own = e.location_url?.trim()
  if (own) return own
  const q = e.location?.trim()
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null
}

export const eur = (n: number) =>
  new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(n)

/** Čas cesty ako „1 h 05 min“ / „40 min“. */
export function fmtDrive(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h === 0 ? `${m} min` : `${h} h ${String(m).padStart(2, '0')} min`
}
