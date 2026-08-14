import { useState } from 'react'
import type { AudioEngine } from '../audio/AudioEngine'
import { MainTonePanel } from './MainTonePanel'
import { DualTonePanel } from './DualTonePanel'
import { SplitPanel } from './SplitPanel'
import { MasterPanel } from './MasterPanel'
import { RecorderPanel } from './RecorderPanel'
import { WorkstationToolsPanel } from './WorkstationToolsPanel'
import { PresetPanel } from './PresetPanel'
import { MidiPanel } from './MidiPanel'
import { KeyboardPanel } from './KeyboardPanel'
import { EngineStatus } from './EngineStatus'
import { SampleStatus } from './SampleStatus'
import { ErrorBoundary } from './ErrorBoundary'
import { getMidiManager } from '../midi/MidiManager'
import { getNoteEventBus } from '../midi/NoteEventBus'
import { getQwertyManager } from '../keyboard/QwertyManager'
import { Arpeggiator } from '../performance/Arpeggiator'
import { ArpeggiatorPanel } from './ArpeggiatorPanel'
import { PortamentoPanel } from './PortamentoPanel'
import { Tabs, TabsList, TabsTrigger } from './ui/tabs'
import { Button } from './ui/button'

export type InspectorTab = 'tone' | 'fx' | 'tools' | 'system'

export function WorkstationInspector({ engine }: { engine: AudioEngine }) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('tone')
  const [collapsed, setCollapsed] = useState(false)

  const [arp] = useState(() => {
    const bus = getNoteEventBus()
    const instance = new Arpeggiator(engine, bus)
    engine.setArpeggiatorRef(instance)
    return instance
  })

  return (
    <section
      className={`ws-inspector bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col shrink-0 ${
        collapsed ? 'ws-inspector--collapsed' : ''
      }`}
      aria-label="Workstation Inspector"
    >
      <div className="ws-inspector__header flex items-center justify-between px-3 py-1.5 bg-secondary/30 border-b border-border flex-wrap gap-2">
        <Tabs value={activeTab} onValueChange={(val) => {
          setActiveTab(val as InspectorTab)
          if (collapsed) setCollapsed(false)
        }} className="w-auto">
          <TabsList className="bg-transparent p-0 gap-1">
            <TabsTrigger
              value="tone"
              className={`ws-tab ${activeTab === 'tone' ? 'ws-tab--active' : ''}`}
            >
              <span className="ws-tab__icon">🎛️</span> Tone & Layers
            </TabsTrigger>
            <TabsTrigger
              value="fx"
              className={`ws-tab ${activeTab === 'fx' ? 'ws-tab--active' : ''}`}
            >
              <span className="ws-tab__icon">🎚️</span> FX & Expression
            </TabsTrigger>
            <TabsTrigger
              value="tools"
              className={`ws-tab ${activeTab === 'tools' ? 'ws-tab--active' : ''}`}
            >
              <span className="ws-tab__icon">🎙️</span> Tools & Presets
            </TabsTrigger>
            <TabsTrigger
              value="system"
              className={`ws-tab ${activeTab === 'system' ? 'ws-tab--active' : ''}`}
            >
              <span className="ws-tab__icon">⚙️</span> System & MIDI
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="btn btn--sm ws-inspector__toggle text-xs"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'Expand Workstation Inspector' : 'Collapse Workstation Inspector'}
        >
          {collapsed ? '▲ Expand Inspector' : '▼ Minimize Inspector'}
        </Button>
      </div>

      <div className="ws-inspector__body p-2.5 max-h-[380px] overflow-y-auto" style={{ display: collapsed ? 'none' : 'block' }}>
        <div className={`ws-panel-grid ${activeTab === 'tone' ? '' : 'ws-panel-grid--hidden'}`}>
          <ErrorBoundary name="Main Tone & Effects">
            <MainTonePanel engine={engine} />
          </ErrorBoundary>
          <ErrorBoundary name="Dual Tone Layer">
            <DualTonePanel engine={engine} />
          </ErrorBoundary>
          <ErrorBoundary name="Keyboard Split">
            <SplitPanel />
          </ErrorBoundary>
        </div>

        <div className={`ws-panel-grid ${activeTab === 'fx' ? '' : 'ws-panel-grid--hidden'}`}>
          <ErrorBoundary name="Arpeggiator">
            <ArpeggiatorPanel arp={arp} />
          </ErrorBoundary>
          <ErrorBoundary name="Portamento Glide">
            <PortamentoPanel engine={engine} />
          </ErrorBoundary>
          <ErrorBoundary name="Master Bus EQ">
            <MasterPanel />
          </ErrorBoundary>
        </div>

        <div className={`ws-panel-grid ${activeTab === 'tools' ? '' : 'ws-panel-grid--hidden'}`}>
          <ErrorBoundary name="Workstation Tools">
            <WorkstationToolsPanel />
          </ErrorBoundary>
          <ErrorBoundary name="Recorder & Performance">
            <RecorderPanel />
          </ErrorBoundary>
          <ErrorBoundary name="Presets">
            <PresetPanel />
          </ErrorBoundary>
        </div>

        <div className={`ws-panel-grid ${activeTab === 'system' ? '' : 'ws-panel-grid--hidden'}`}>
          <ErrorBoundary name="MIDI Manager">
            <MidiPanel midi={getMidiManager(getNoteEventBus())} engine={engine} />
          </ErrorBoundary>
          <ErrorBoundary name="QWERTY Keyboard Map">
            <KeyboardPanel qwerty={getQwertyManager(getNoteEventBus())} />
          </ErrorBoundary>
          <div className="ws-sys-card p-3 bg-secondary/20 rounded-md border border-border">
            <h4 className="ws-sys-card__title text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Engine & Sample Diagnostics
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              <SampleStatus engine={engine} instrumentId={engine.instrumentId} />
              <EngineStatus engine={engine} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
