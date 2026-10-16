import { PageHeader, Section } from '../components/ui'

export function Placeholder({ title, step }: { title: string; step: number }) {
  return (
    <div className="page">
      <PageHeader title={title} />
      <Section><p className="muted">Táto časť sa stavia v kroku {step}.</p></Section>
    </div>
  )
}
