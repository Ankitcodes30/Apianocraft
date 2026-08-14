import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import type { DiagnosticsSnapshot } from '../audio/types'
import { useFps } from '../hooks/useFps'

/** Lightweight status strip; polls diagnostics at 2 Hz — never on the note path. */
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
        className={`chip chip--${pill} cursor-pointer hover:opacity-90 transition-opacity`}
        title="Click to toggle detailed engine telemetry"
      >
        <span>audio: {diag.contextState}</span>
        <span className="opacity-60 text-[10px]">
          ({diag.activeVoices}/{diag.polyphonyCap} v {expanded ? '▲' : '▼'})
        </span>
      </button>

      {/* Render all diagnostic chips for smoke test verification & developer telemetry */}
      <div className={`${expanded ? 'inline-flex flex-wrap items-center gap-1.5' : 'hidden'} md:inline-flex md:flex-wrap md:items-center md:gap-1.5`}>
        <span className="chip">limiter: {diag.limiter}</span>
        <span className="chip">latency: {diag.baseLatencyMs.toFixed(1)} ms</span>
        <span className="chip">
          voices: {diag.activeVoices}/{diag.polyphonyCap}
        </span>
        <span className="chip">sustained: {diag.sustainedVoices}</span>
        <span className="chip">started: {diag.totalStarted}</span>
        <span className="chip">steals: {diag.steals}</span>
        <span className="chip">dropped: {diag.dropped}</span>
        <span className="chip">retrigger: {diag.retriggers}</span>
        <span className="chip">loads: {diag.pendingLoads}</span>
        <span className="chip">fps: {fps}</span>
      </div>
    </div>
  )
}
