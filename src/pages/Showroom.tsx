import { Garage3D } from '../components/Garage3D'
import { PageHeader } from '../components/ui'

/** Zubor a Sugga v 3D garáži. Dá sa otáčať prstom a približovať. */
export function Showroom() {
  return (
    <div className="page">
      <PageHeader title="Showroom" sub="Zubor a Sugga v garáži. Potiahni prstom, otočíš kameru." />
      <Garage3D interactive className="rounded-[var(--card-r)] border line h-[62dvh] min-h-[320px]" />
    </div>
  )
}
