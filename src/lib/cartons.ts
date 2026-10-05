// Kartóny: typy, popisy a znamienka pohybov. Stav sa vždy počíta z carton_movements.

export type Flavor = {
  id: string
  name: string
  label: string | null
  color_bg: string | null
  color_text: string | null
  color_border: string | null
  sort_order: number
  active: boolean
}

export type MoveType = 'delivery' | 'returned' | 'event' | 'opened_garage' | 'damaged' | 'adjustment'

export type Movement = {
  id: string
  flavor_id: string
  cartons: number
  type: MoveType
  event_id: string | null
  recipient: string | null
  note: string | null
  counts_in_stock: boolean
  occurred_at: string
  events: { id: string; title: string; departments: string[] } | null
}

export const MOVE_LABEL: Record<MoveType, string> = {
  delivery: 'Závoz',
  returned: 'Vrátené',
  event: 'Na event',
  opened_garage: 'Otvorené v garáži',
  damaged: 'Poškodené',
  adjustment: 'Inventúra / oprava',
}

// +1 = príjem do skladu, -1 = výdaj zo skladu
export const MOVE_SIGN: Record<Exclude<MoveType, 'adjustment'>, 1 | -1> = {
  delivery: 1,
  returned: 1,
  event: -1,
  opened_garage: -1,
  damaged: -1,
}

export const flavorName = (f: Pick<Flavor, 'label' | 'name'>) => f.label || f.name

export function flavorStyle(f: Pick<Flavor, 'color_bg' | 'color_text' | 'color_border'>) {
  return {
    background: f.color_bg ?? 'var(--card)',
    color: f.color_text ?? 'var(--fg)',
    borderColor: f.color_border ?? 'var(--line)',
  }
}
