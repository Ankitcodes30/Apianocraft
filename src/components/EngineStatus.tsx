import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { DiagnosticsSnapshot } from '../audio/types'
import { useFps } from '../hooks/useFps'

/** Clean engine status strip; polls diagnostics at 2 Hz — never on the note path. */
export function EngineStatus({ engine }: { engine: AudioEngine }) {
  const [diag, setDiag] = useState<DiagnosticsSnapshot | null>(() => engine.getDiagnostics())
  const [expanded, setExpanded] = useState(false)
  const fps = useFps()

  useEffect(() => {
    setDiag(engine.getDiagnostics())
    const id = window.setInterval(() => setDiag(engine.getDiagnostics()), 500)
    return () => window.clearInterval(id)
  }, [engine])

  if (!diag) return null

  const pill =
    diag.contextState === 'running' ? 'ok' : diag.contextState === 'suspended' ? 'warn' : 'bad'

  return (
    <div className="inline-flex items-center gap-1.5" data-engine-status>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`chip chip--${pill} cursor-pointer hover:opacity-90 transition-opacity text-xs py-1 px-2.5 rounded-full`}
        title="Click to toggle engine details"
      >
        <span>audio: {diag.contextState}</span>
        <span className="opacity-70 text-[10px] ml-1">
          ({diag.activeVoices}/{diag.polyphonyCap} v {expanded ? '▲' : '▼'})
        </span>
      </button>

      {/* Clean essential telemetry details */}
      <div className={`${expanded ? 'inline-flex flex-wrap items-center gap-1.5' : 'hidden'} text-xs`}>
        <span className="chip">latency: {diag.baseLatencyMs.toFixed(1)} ms</span>
        <span className="chip">fps: {fps}</span>
      </div>
    </div>
  )
}
