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
  event_car: '#fff',
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

export const eur = (n: number) =>
  new Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' }).format(n)
