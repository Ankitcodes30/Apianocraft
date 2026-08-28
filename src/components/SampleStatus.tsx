import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { SampleLoadState } from '../audio/samples/types'

/** Sample-load progress strip for the currently selected sampled instrument. */
export function SampleStatus({ engine, instrumentId }: { engine: AudioEngine; instrumentId: string }) {
  const [state, setState] = useState<SampleLoadState>(() => engine.getInstrumentLoadState(instrumentId))

  useEffect(() => {
    setState(engine.getInstrumentLoadState(instrumentId))
    const unsub = engine.subscribe((e) => {
      if (e.type === 'load' && e.instrumentId === instrumentId) setState(e.state)
    })
    const id = window.setInterval(() => setState(engine.getInstrumentLoadState(instrumentId)), 500)
    return () => {
      unsub()
      window.clearInterval(id)
    }
  }, [engine, instrumentId])

  if (state.status === 'idle' || state.status === 'ready' && state.progress.totalFiles === 0) return null

  const p = state.progress
  const percent = p.totalFiles > 0 ? Math.round((p.loadedFiles / p.totalFiles) * 100) : 0
  const pill = state.status === 'ready' ? 'ok' : state.status === 'error' ? 'bad' : 'warn'
  const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div className="sample-status" aria-live="polite">
      {state.status === 'loading' && (
        <>
          <span className={`chip chip--${pill}`}>loading samples</span>
          <span className="chip">
            {p.loadedFiles}/{p.totalFiles} files ({percent}%) — {mb(p.loadedBytes)}/{mb(p.totalBytes)}
          </span>
          <progress className="sample-status__bar" max={p.totalFiles} value={p.loadedFiles} />
        </>
      )}
      {state.status === 'ready' && (
        <span className={`chip chip--${pill}`}>samples ready — {p.totalFiles} files, {mb(p.totalBytes)}</span>
      )}
      {state.status === 'error' && (
        <>
          <span className={`chip chip--${pill}`}>sample load failed</span>
          <span className="chip">{state.error}</span>
          <button type="button" className="btn" onClick={() => engine.reloadInstrument(instrumentId)}>
            Retry
          </button>
        </>
      )}
    </div>
  )
}
