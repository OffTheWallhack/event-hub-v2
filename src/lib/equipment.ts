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
  'id, name, category, quantity, qty_broken, qty_borrowed, status, status_note, held_by, status_event_id, notes, active'
