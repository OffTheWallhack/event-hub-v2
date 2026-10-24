import { ThemePicker } from '../components/ThemePicker'
import { PageHeader } from '../components/ui'

export function Appearance() {
  return (
    <div className="page">
      <PageHeader title="Vzhľad" sub="Téma a veľkosť písma." />
      <ThemePicker />
    </div>
  )
}
