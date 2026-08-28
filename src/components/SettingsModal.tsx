import { useEffect, useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { getThemeManager, type ThemeMode } from '../theme/ThemeManager'
import { Card, CardHeader } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export type SettingsTab = 'appearance' | 'preferences' | 'audio'

export interface SettingsModalProps {
  engine: AudioEngine
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ engine, isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getThemeManager().getPreference())
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() => getThemeManager().getEffectiveTheme())

  // Engine & Performance state
  const [mousePerf, setMousePerf] = useState(() => {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('apianocraft-mouse-perf') !== 'false'
      : true
  })
  const [engineState, setEngineState] = useState(() => engine.state)
  const [polyphony] = useState(() => engine.getDiagnostics().polyphonyCap)

  useEffect(() => {
    const unsubTheme = getThemeManager().subscribe((eff, pref) => {
      setEffectiveTheme(eff)
      setThemeMode(pref)
    })

    const unsubEngine = engine.subscribe((e) => {
      if (e.type === 'state') setEngineState(e.state)
    })

    return () => {
      unsubTheme()
      unsubEngine()
    }
  }, [engine])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleThemeChange = (mode: ThemeMode) => {
    getThemeManager().setPreference(mode)
    setThemeMode(mode)
  }

  const handleMousePerfToggle = () => {
    const next = !mousePerf
    setMousePerf(next)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('apianocraft-mouse-perf', String(next))
    }
    // Dispatch window event so PianoKeyboard listens
    window.dispatchEvent(new CustomEvent('mouse-perf-changed', { detail: { enabled: next } }))
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation()
          onClose()
        }
      }}
      aria-modal="true"
      role="dialog"
      aria-label="Workstation Settings"
    >
      <div
        className="w-[90vw] max-w-[620px] h-[460px] max-h-[85vh] bg-card text-card-foreground border border-border rounded-xl shadow-2xl flex flex-col relative z-[10000] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-foreground">⚙️ Workstation Settings</span>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Preferences
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close Settings Modal"
          >
            ✕
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-card">
          {/* Navigation Sidebar */}
          <nav className="w-full md:w-44 bg-secondary/15 border-b md:border-b-0 md:border-r border-border p-2.5 flex md:flex-col gap-1.5 shrink-0 overflow-y-auto">
            <button
              type="button"
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors text-left ${
                activeTab === 'appearance' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
              }`}
              onClick={() => setActiveTab('appearance')}
            >
              <span>🎨</span> Appearance
            </button>
            <button
              type="button"
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors text-left ${
                activeTab === 'preferences' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
              }`}
              onClick={() => setActiveTab('preferences')}
            >
              <span>⚡</span> Preferences
            </button>
            <button
              type="button"
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors text-left ${
                activeTab === 'audio' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
              }`}
              onClick={() => setActiveTab('audio')}
            >
              <span>🔊</span> Audio & DSP
            </button>
          </nav>

          {/* Category Content Area */}
          <div className="flex-1 min-w-0 min-h-0 p-4 overflow-y-auto space-y-4 bg-card text-foreground">
            {/* APPEARANCE SETTINGS */}
            {activeTab === 'appearance' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Theme & Visual Mode</h3>
                  <p className="text-xs text-muted-foreground">Select your preferred color theme for Apianocraft.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleThemeChange('system')}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                      themeMode === 'system'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-secondary/20 hover:bg-secondary/40'
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground">💻 System Default</span>
                    <span className="text-[11px] text-muted-foreground">Follow operating system preference</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                      themeMode === 'dark'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-secondary/20 hover:bg-secondary/40'
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground">🌙 Dark Theme</span>
                    <span className="text-[11px] text-muted-foreground">Sleek studio dark aesthetics</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                      themeMode === 'light'
                        ? 'border-primary bg-primary/10 ring-1 ring-primary'
                        : 'border-border bg-secondary/20 hover:bg-secondary/40'
                    }`}
                  >
                    <span className="text-xs font-bold text-foreground">☀️ Light Theme</span>
                    <span className="text-[11px] text-muted-foreground">Bright high-contrast interface</span>
                  </button>
                </div>

                <div className="p-3 bg-secondary/20 rounded-lg border border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Active Effective Theme:</span>
                  <Badge variant="secondary" className="capitalize">
                    {effectiveTheme} mode ({themeMode})
                  </Badge>
                </div>
              </div>
            )}

            {/* PREFERENCES SETTINGS */}
            {activeTab === 'preferences' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Interaction & Performance Preferences</h3>
                  <p className="text-xs text-muted-foreground">Configure mouse performance and polyphony limits.</p>
                </div>

                <Card className="border-border bg-secondary/20">
                  <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Mouse Pitch & Modulation Tracking</h4>
                      <p className="text-[11px] text-muted-foreground">Control Pitch Bend & Modulation HUD when dragging across piano keys.</p>
                    </div>
                    <Button
                      type="button"
                      variant={mousePerf ? 'on' : 'outline'}
                      size="sm"
                      onClick={handleMousePerfToggle}
                      className={mousePerf ? 'btn--on' : ''}
                    >
                      Mouse Performance {mousePerf ? 'ON' : 'OFF'}
                    </Button>
                  </CardHeader>
                </Card>

                <Card className="border-border bg-secondary/20">
                  <CardHeader className="p-3 flex flex-row items-center justify-between space-y-0">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Adaptive Polyphony Cap</h4>
                      <p className="text-[11px] text-muted-foreground">Maximum simultaneous voices permitted on the Web Audio engine.</p>
                    </div>
                    <Badge variant="secondary" className="tabular-nums font-mono text-xs">
                      {polyphony} Voices Max
                    </Badge>
                  </CardHeader>
                </Card>
              </div>
            )}

            {/* AUDIO & DSP SETTINGS */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Audio Context & DSP Protection</h3>
                  <p className="text-xs text-muted-foreground">Web Audio context status, sample rate, and limiter diagnostics.</p>
                </div>

                <div className="p-3 bg-secondary/20 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Audio Context State:</span>
                    <Badge variant={engineState === 'running' ? 'accent' : 'outline'} className="capitalize">
                      {engineState}
                    </Badge>
                  </div>

                  {engineState === 'suspended' && (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="w-full text-xs mt-2"
                      onClick={() => void engine.unlock()}
                    >
                      ▶ Resume Audio Context
                    </Button>
                  )}

                  <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                    <span className="text-muted-foreground">Sample Rate:</span>
                    <span className="font-mono text-xs">{engine.getDiagnostics().sampleRate} Hz</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                    <span className="text-muted-foreground">Audio Base Latency:</span>
                    <span className="font-mono text-xs">{engine.getDiagnostics().baseLatencyMs.toFixed(1)} ms</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                    <span className="text-muted-foreground">Master Limiter Worklet:</span>
                    <span className="font-mono text-xs text-emerald-500 font-semibold">Protected ({engine.getDiagnostics().limiter})</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-4 py-2.5 bg-secondary/20 border-t border-border">
          <Button type="button" variant="default" size="sm" onClick={onClose} className="px-5 text-xs">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
