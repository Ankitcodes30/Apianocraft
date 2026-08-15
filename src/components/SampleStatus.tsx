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
  const dotColor = state.status === 'ready' ? '#6FA77A' : state.status === 'error' ? '#A84A4A' : '#C89040'
  const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`

  return (
    <div className="sample-status inline-flex items-center gap-1.5 font-mono text-[10px]" aria-live="polite">
      {state.status === 'loading' && (
        <>
          <span className="chip text-[#F2F2F2]">
            <span className="w-1.5 h-1.5 rounded-full mr-1 inline-block" style={{ backgroundColor: dotColor }} />
            LOADING SAMPLES
          </span>
          <span className="chip text-[#B5B5B5]">
            {p.loadedFiles}/{p.totalFiles} files ({percent}%) — {mb(p.loadedBytes)}/{mb(p.totalBytes)}
          </span>
          <progress className="sample-status__bar h-1.5 w-16 accent-[#5B7FA3] rounded" max={p.totalFiles} value={p.loadedFiles} />
        </>
      )}
      {state.status === 'ready' && (
        <span className="chip text-[#F2F2F2]">
          <span className="w-1.5 h-1.5 rounded-full mr-1 inline-block" style={{ backgroundColor: dotColor }} />
          SAMPLES READY ({p.totalFiles} files, {mb(p.totalBytes)})
        </span>
      )}
      {state.status === 'error' && (
        <>
          <span className="chip text-[#A84A4A]">
            <span className="w-1.5 h-1.5 rounded-full mr-1 inline-block" style={{ backgroundColor: dotColor }} />
            SAMPLE LOAD FAILED
          </span>
          <span className="chip text-[#A84A4A]">{state.error}</span>
          <button type="button" className="btn btn--sm text-[10px]" onClick={() => engine.reloadInstrument(instrumentId)}>
            Retry
          </button>
        </>
      )}
    </div>
  )
}
