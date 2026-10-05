export function Placeholder({ title, step }: { title: string; step: number }) {
  return (
    <section>
      <h1 className="display text-4xl font-bold">{title}</h1>
      <div className="card p-5 mt-4">
        <p className="muted">Táto časť sa stavia v kroku {step}.</p>
      </div>
    </section>
  )
}
