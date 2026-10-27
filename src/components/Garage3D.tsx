import { useEffect, useRef, useState } from 'react'
import type { GarageHandle } from '../three/garage'

/**
 * 3D garáž so Zuborom a Suggou. three.js aj modely sa sťahujú až keď sa komponent ukáže,
 * takže zvyšok appky to nespomaľuje. Kým sa načítava, je vidieť len tmavé pozadie.
 */
export function Garage3D({ interactive = false, className = '' }: { interactive?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let handle: GarageHandle | null = null
    let gone = false
    import('../three/garage')
      .then(({ mountGarage }) => {
        if (gone) return
        handle = mountGarage(canvas, {
          interactive,
          onProgress: setProgress,
          onReady: () => setReady(true),
          onError: setError,
        })
      })
      .catch(() => setError('3D sa nepodarilo spustiť.'))
    return () => { gone = true; handle?.dispose() }
  }, [interactive])

  return (
    <div className={'overflow-hidden bg-[#050507] ' + (className.includes('absolute') ? '' : 'relative ') + className}>
      <canvas ref={ref} className={'block w-full h-full transition-opacity duration-700 ' + (ready ? 'opacity-100' : 'opacity-0')} style={{ touchAction: interactive ? 'none' : 'auto' }} />
      {!ready && !error && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
          <span className="text-[11px] mono text-white/40">{progress > 0 ? `Načítavam garáž ${Math.round(progress * 100)} %` : 'Otváram garáž…'}</span>
        </div>
      )}
      {error && <p className="absolute inset-0 grid place-items-center text-xs text-white/40 px-4 text-center">{error}</p>}
    </div>
  )
}
