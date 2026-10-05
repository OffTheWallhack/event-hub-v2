import { useAuth } from '../lib/auth'

export function Login() {
  const { signIn } = useAuth()
  return (
    <div className="min-h-full grid place-items-center px-5">
      <div className="w-full max-w-sm">
        <p className="display text-sm font-semibold muted">Red Bull · Event Car</p>
        <h1 className="display text-6xl font-bold leading-none mt-1">Event Hub</h1>
        <p className="muted mt-3">Eventy, technika, kartóny a financie na jednom mieste.</p>
        <button
          onClick={signIn}
          className="mt-8 w-full h-12 rounded-xl font-semibold text-white bg-[var(--color-signal)] active:scale-[0.99]"
        >
          Prihlásiť sa cez Google
        </button>
        <p className="text-xs muted mt-4">Prístup schvaľuje administrátor.</p>
      </div>
    </div>
  )
}
