// Čo ešte chýba na evente (jedno pravidlo pre stránku eventu aj pre dashboard).
import { type EventRow, startDay } from './events'

/** Kartóny sa v appke sledujú od štartového stavu 5. 10. 2026, staršie eventy sa na ne nekontrolujú. */
const CARTONS_FROM = '2026-10-05'

export type Counts = {
  drivers: number            // vodiči na evente
  externalWithoutPayout: number // vodiči (nie ja) bez výplaty
  cartons: number            // riadky kartónov na evente
  gear: number               // položky techniky na evente
}

/** Zoznam toho, čo chýba (prázdny = event je kompletný). Zrušené eventy sa nekontrolujú. */
export function missingOf(
  ev: Pick<EventRow, 'status' | 'event_type' | 'location' | 'start_date'>,
  c: Counts,
  today: string,
): string[] {
  if (ev.status === 'cancelled') return []
  const out: string[] = []
  const started = startDay(ev) <= today
  if (c.drivers === 0) out.push('vodič')
  if (c.externalWithoutPayout > 0) out.push('výplata')
  if (!ev.location?.trim()) out.push('lokalita')
  if (ev.event_type === 'event_car' && started) {
    if (c.gear === 0) out.push('technika')
    if (c.cartons === 0 && startDay(ev) >= CARTONS_FROM) out.push('kartóny')
  }
  return out
}
