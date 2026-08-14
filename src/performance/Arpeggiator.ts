import type { AudioEngine } from '../audio/AudioEngine'
import type { ArpeggiatorSnapshot } from '../audio/types'
import type { NoteEventBus } from '../midi/NoteEventBus'

export type ArpRate = '1/1' | '1/2' | '1/4' | '1/8' | '1/16'
export type ArpDirection = 'up' | 'down' | 'up-down' | 'random'

export class Arpeggiator {
  private enabled = false
  private rate: ArpRate = '1/8'
  private direction: ArpDirection = 'up'
  private octaveRange = 1
  private gate = 0.8

  private heldInputNotes = new Set<number>()
  private activeArpNote: number | null = null
  private stepIndex = 0
  private timerId: number | null = null
  private unsubscribeBus: (() => void) | null = null
  private totalGeneratedCount = 0

  constructor(
    private readonly engine: AudioEngine,
    private readonly bus: NoteEventBus,
  ) {
    this.initBusListener()
  }

  private initBusListener(): void {
    this.unsubscribeBus = this.bus.subscribe((e) => {
      if (e.kind === 'note-on') {
        if (e.source !== 'programmatic') {
          this.heldInputNotes.add(e.note)
          if (this.enabled) {
            this.syncTick()
          }
        }
      } else if (e.kind === 'note-off') {
        if (e.source !== 'programmatic') {
          this.heldInputNotes.delete(e.note)
          if (this.heldInputNotes.size === 0) {
            this.stopActiveArpNote()
            this.stopTick()
          } else if (this.enabled) {
            this.syncTick()
          }
        }
      } else if (e.kind === 'panic') {
        this.panic()
      }
    })
  }

  get isEnabled(): boolean {
    return this.enabled
  }

  get currentRate(): ArpRate {
    return this.rate
  }

  get currentDirection(): ArpDirection {
    return this.direction
  }

  get currentOctaveRange(): number {
    return this.octaveRange
  }

  get currentGate(): number {
    return this.gate
  }

  setEnabled(val: boolean): void {
    if (this.enabled === val) return
    this.enabled = val
    if (!val) {
      this.stopActiveArpNote()
      this.stopTick()
      this.stepIndex = 0
    } else {
      this.syncTick()
    }
  }

  setRate(r: ArpRate): void {
    this.rate = r
    if (this.enabled) this.syncTick()
  }

  setDirection(d: ArpDirection): void {
    this.direction = d
    this.stepIndex = 0
  }

  setOctaveRange(oct: number): void {
    this.octaveRange = Math.max(1, Math.min(4, Math.round(oct)))
    this.stepIndex = 0
  }

  setGate(g: number): void {
    this.gate = Math.max(0.1, Math.min(1.0, g))
  }

  panic(): void {
    this.heldInputNotes.clear()
    this.stopActiveArpNote()
    this.stopTick()
    this.stepIndex = 0
  }

  dispose(): void {
    this.panic()
    if (this.unsubscribeBus) {
      this.unsubscribeBus()
      this.unsubscribeBus = null
    }
  }

  getDiagnostics(): ArpeggiatorSnapshot {
    return {
      enabled: this.enabled,
      rate: this.rate,
      direction: this.direction,
      octaveRange: this.octaveRange,
      gate: this.gate,
      heldCount: this.heldInputNotes.size,
      generatedCount: this.totalGeneratedCount,
    }
  }

  private getStepIntervalMs(): number {
    const bpm = 120 // Standard workstation clock base
    const beatMs = (60 / bpm) * 1000
    switch (this.rate) {
      case '1/1':
        return beatMs * 4
      case '1/2':
        return beatMs * 2
      case '1/4':
        return beatMs
      case '1/8':
        return beatMs * 0.5
      case '1/16':
      default:
        return beatMs * 0.25
    }
  }

  private buildPattern(): number[] {
    if (this.heldInputNotes.size === 0) return []
    const sorted = Array.from(this.heldInputNotes).sort((a, b) => a - b)
    const expanded: number[] = []
    for (let o = 0; o < this.octaveRange; o++) {
      for (const n of sorted) {
        const target = n + o * 12
        if (target <= 127) expanded.push(target)
      }
    }
    return expanded
  }

  private stopTick(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId)
      this.timerId = null
    }
  }

  private stopActiveArpNote(): void {
    if (this.activeArpNote !== null) {
      this.engine.noteOff({ note: this.activeArpNote })
      this.activeArpNote = null
    }
  }

  private syncTick(): void {
    this.stopTick()
    if (!this.enabled || this.heldInputNotes.size === 0) return

    // Immediately trigger first step
    this.tick()

    const ms = this.getStepIntervalMs()
    this.timerId = window.setInterval(() => {
      this.tick()
    }, ms)
  }

  private tick(): void {
    const pattern = this.buildPattern()
    if (pattern.length === 0) {
      this.stopActiveArpNote()
      return
    }

    let idx = 0
    if (this.direction === 'random') {
      idx = Math.floor(Math.random() * pattern.length)
    } else if (this.direction === 'up') {
      idx = this.stepIndex % pattern.length
      this.stepIndex++
    } else if (this.direction === 'down') {
      idx = (pattern.length - 1 - (this.stepIndex % pattern.length))
      this.stepIndex++
    } else if (this.direction === 'up-down') {
      if (pattern.length === 1) {
        idx = 0
      } else {
        const cycleLen = (pattern.length - 1) * 2
        const pos = this.stepIndex % cycleLen
        if (pos < pattern.length) {
          idx = pos
        } else {
          idx = cycleLen - pos
        }
        this.stepIndex++
      }
    }

    const nextNote = pattern[idx]
    if (nextNote === undefined) return

    // Release previously generated note
    this.stopActiveArpNote()

    // Trigger new arpeggiated note
    this.activeArpNote = nextNote
    this.totalGeneratedCount++
    this.engine.noteOn({ note: nextNote, velocity: 0.8, source: 'programmatic' })

    // Schedule off based on gate fraction
    const gateMs = this.getStepIntervalMs() * this.gate
    window.setTimeout(() => {
      if (this.activeArpNote === nextNote) {
        this.engine.noteOff({ note: nextNote })
        this.activeArpNote = null
      }
    }, Math.max(10, gateMs))
  }
}
