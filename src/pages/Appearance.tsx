import { ThemePicker } from '../components/ThemePicker'
import { PageHeader } from '../components/ui'

export function Appearance() {
  return (
    <div className="page">
      <PageHeader title="Vzhľad" sub="Svetlá alebo tmavá téma." />
      <ThemePicker />
    </div>
  )
}
