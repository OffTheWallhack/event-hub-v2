/** Zablokuje celú obrazovku, kým sa niečo deje (napr. nahrávanie dokladu). progress: 0–100 alebo null = bez percent. */
export function BusyOverlay({ title, progress }: { title: string; progress: number | null }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center p-6" role="alert" aria-busy="true">
      <div className="card p-5 w-full max-w-sm text-center">
        <p className="display text-2xl font-bold">{title}</p>
        <div className="h-3 rounded-full bg-[var(--line)] mt-4 overflow-hidden">
          {progress === null ? (
            <div className="h-3 w-1/3 rounded-full bg-[var(--color-signal)] animate-pulse" style={{ animation: 'busy-slide 1.1s ease-in-out infinite' }} />
          ) : (
            <div className="h-3 rounded-full bg-[var(--color-signal)] transition-all" style={{ width: progress + '%' }} />
          )}
        </div>
        <p className="text-sm muted mt-3">{progress !== null && progress < 100 ? `${progress} %` : 'Počkaj, nič nezatváraj a neťukaj.'}</p>
      </div>
    </div>
  )
}
