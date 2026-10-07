// Technika: typy a popisy. Položky sú po skupinách s počtom kusov (quantity),
// pokazené / požičané kusy sú v qty_broken / qty_borrowed.

export type EqCategory = 'coolers' | 'audio' | 'branding' | 'others'
export type EqStatus = 'ok' | 'broken' | 'lost' | 'rented_out' | 'borrowed' | 'in_rent'

export type Equipment = {
  id: string
  name: string
  category: EqCategory
  quantity: number
  qty_broken: number
  qty_borrowed: number
  status: EqStatus
  status_note: string | null
  held_by: string | null
  status_event_id: string | null
  notes: string | null
  active: boolean
  photo_path: string | null
}

export const CATEGORY_LABEL: Record<EqCategory, string> = {
  coolers: 'Chladničky',
  audio: 'Audio',
  branding: 'Branding',
  others: 'Ostatné',
}
export const CATEGORIES: EqCategory[] = ['coolers', 'audio', 'branding', 'others']

export const STATUS_LABEL: Record<EqStatus, string> = {
  ok: 'OK',
  broken: 'Pokazené',
  borrowed: 'Požičané',
  lost: 'Stratené',
  in_rent: 'V prenájme',
  rented_out: 'Prenajaté',
}
// stavy ponúkané pri rýchlej zmene
export const QUICK_STATUSES: EqStatus[] = ['ok', 'broken', 'borrowed', 'lost', 'in_rent']
export const STATUS_COLOR: Record<EqStatus, string> = {
  ok: '#2e8b57',
  broken: 'var(--color-signal)',
  borrowed: 'var(--color-sky)',
  lost: '#555',
  in_rent: 'var(--color-amber)',
  rented_out: 'var(--color-amber)',
}
// stavy, pri ktorých má zmysel „komu“
export const NEEDS_HOLDER: EqStatus[] = ['borrowed', 'in_rent', 'rented_out']

export const EQ_COLUMNS =
  'id, name, category, quantity, qty_broken, qty_borrowed, status, status_note, held_by, status_event_id, notes, active, photo_path'

// Ikonka podľa názvu, inak podľa kategórie.
const ICONS: [RegExp, string][] = [
  [/cdj/i, '💿'],
  [/mix|konzol|djm/i, '🎚️'],
  [/mic/i, '🎤'],
  [/sub|repro|rcf|montarbo|\bdb\b/i, '🔊'],
  [/stojan|tyc|tyč|tripod|cikcak|rack/i, '🗼'],
  [/cooler|chlad/i, '🧊'],
  [/desk/i, '🎧'],
  [/neon/i, '💡'],
  [/slnecnik|slnečník/i, '⛱️'],
  [/kock/i, '🧱'],
  [/tabul/i, '🪧'],
  [/nalep|logo/i, '🏷️'],
  [/branding|9m/i, '🚩'],
  [/gener/i, '⚡'],
  [/kompres/i, '💨'],
  [/playstation|ps\d/i, '🎮'],
]
const CAT_ICON: Record<EqCategory, string> = { coolers: '🧊', audio: '🔊', branding: '🚩', others: '📦' }

export function eqIcon(e: Pick<Equipment, 'name' | 'category'>): string {
  return ICONS.find(([re]) => re.test(e.name))?.[1] ?? CAT_ICON[e.category]
}

// „Cooler: Small“ → ['Small', 'Cooler']
export function splitName(n: string): [string, string | null] {
  const m = /^([^:]{2,20}):\s*(.+)$/.exec(n)
  return m ? [m[2], m[1]] : [n, null]
}

// Záložky na stránke Technika (ako v starej appke): odvodené z názvu a kategórie.
export type EqGroup = 'Audio' | 'DJ' | 'Cooler' | 'Rekvizity' | 'Iné'
export const EQ_GROUPS: EqGroup[] = ['Audio', 'DJ', 'Cooler', 'Rekvizity', 'Iné']
export function eqGroup(e: Pick<Equipment, 'name' | 'category'>): EqGroup {
  if (/cdj|konzol|\bmix\b|djm/i.test(e.name)) return 'DJ'
  return e.category === 'audio' ? 'Audio' : e.category === 'coolers' ? 'Cooler' : e.category === 'branding' ? 'Rekvizity' : 'Iné'
}

/** Koľko kusov je voľných, požičaných a pokazených (pri jednom kuse sa berie aj stav). */
export function eqCounts(e: Pick<Equipment, 'quantity' | 'qty_broken' | 'qty_borrowed' | 'status'>) {
  const lentStatus = e.status === 'borrowed' || e.status === 'in_rent' || e.status === 'rented_out'
  const borrowed = Math.min(e.quantity, e.qty_borrowed || (lentStatus ? e.quantity : 0))
  const broken = Math.min(e.quantity - borrowed, e.qty_broken || (e.status === 'broken' ? e.quantity : 0))
  const lost = e.status === 'lost' ? e.quantity : 0
  return { free: Math.max(0, e.quantity - borrowed - broken - lost), borrowed, broken, lost }
}
