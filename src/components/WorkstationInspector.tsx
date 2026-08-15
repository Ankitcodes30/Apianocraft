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
      className={`ws-inspector bg-[#242424] border border-[#3A3A3A] rounded-[4px] overflow-hidden flex flex-col shrink-0 ${
        collapsed ? 'ws-inspector--collapsed' : ''
      }`}
      aria-label="Workstation Inspector"
    >
      <div className="ws-inspector__header flex items-center justify-between px-3 py-1 bg-[#202020] border-b border-[#3A3A3A] flex-wrap gap-2">
        <Tabs value={activeTab} onValueChange={(val) => {
          setActiveTab(val as InspectorTab)
          if (collapsed) setCollapsed(false)
        }} className="w-auto">
          <TabsList className="bg-[#181818] p-0.5 gap-1 border border-[#3A3A3A] rounded-[4px]">
            <TabsTrigger
              value="tone"
              className={`ws-tab text-xs font-medium px-3 py-1 text-[#B5B5B5] ${activeTab === 'tone' ? 'ws-tab--active text-[#F2F2F2] bg-[#2A2A2A] border-b-2 border-b-[#5B7FA3]' : ''}`}
            >
              <span className="ws-tab__icon">🎛️</span> Tone & Layers
            </TabsTrigger>
            <TabsTrigger
              value="fx"
              className={`ws-tab text-xs font-medium px-3 py-1 text-[#B5B5B5] ${activeTab === 'fx' ? 'ws-tab--active text-[#F2F2F2] bg-[#2A2A2A] border-b-2 border-b-[#5B7FA3]' : ''}`}
            >
              <span className="ws-tab__icon">🎚️</span> FX & Expression
            </TabsTrigger>
            <TabsTrigger
              value="tools"
              className={`ws-tab text-xs font-medium px-3 py-1 text-[#B5B5B5] ${activeTab === 'tools' ? 'ws-tab--active text-[#F2F2F2] bg-[#2A2A2A] border-b-2 border-b-[#5B7FA3]' : ''}`}
            >
              <span className="ws-tab__icon">🎙️</span> Tools & Presets
            </TabsTrigger>
            <TabsTrigger
              value="system"
              className={`ws-tab text-xs font-medium px-3 py-1 text-[#B5B5B5] ${activeTab === 'system' ? 'ws-tab--active text-[#F2F2F2] bg-[#2A2A2A] border-b-2 border-b-[#5B7FA3]' : ''}`}
            >
              <span className="ws-tab__icon">⚙️</span> System & MIDI
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="btn btn--sm ws-inspector__toggle text-[11px] font-medium bg-[#2B2B2B] border-[#3A3A3A] text-[#D5D5D5]"
          onClick={() => setCollapsed((prev) => !prev)}
          title={collapsed ? 'Expand Workstation Inspector' : 'Collapse Workstation Inspector'}
        >
          {collapsed ? '▲ Expand Inspector' : '▼ Minimize Inspector'}
        </Button>
      </div>

      <div className="ws-inspector__body p-2 max-h-[360px] overflow-y-auto" style={{ display: collapsed ? 'none' : 'block' }}>
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
          <div className="ws-sys-card p-2.5 bg-[#292929] rounded-[4px] border border-[#3A3A3A]">
            <h4 className="ws-sys-card__title text-[10px] font-semibold text-[#B5B5B5] uppercase tracking-wider mb-1.5 font-mono">
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
