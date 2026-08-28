import { getNoteEventBus } from '../midi/NoteEventBus'

export const MOUSE_PERFORMANCE_ENTRY_DWELL_MS = 350
export const MOUSE_PERFORMANCE_RECENTER_DWELL_MS = 550
export const MOUSE_PERFORMANCE_DWELL_TOLERANCE_PX = 5
export const MOUSE_PERFORMANCE_RECENTER_MIN_DISPLACEMENT_PX = 15

export interface MousePerfState {
  enabled: boolean
  active: boolean
  settling: boolean
  hasOrigin: boolean
  candidateX: number | null
  candidateY: number | null
  originX: number | null
  originY: number | null
  recenterCandidateX: number | null
  recenterCandidateY: number | null
  recenterTimerRunning: boolean
  recenterTimerElapsedMs: number
  pitchBend: number
  modulation: number
  basePitch: number
  baseMod: number
  entryDwellMs: number
  recenterDwellMs: number
  dwellTolerancePx: number
  minDisplacementPx: number
  lastPointerX: number | null
  lastPointerY: number | null
}

export type MousePerfListener = (state: MousePerfState) => void

const STORAGE_KEY = 'apianocraft_mouse_perf_enabled'

export class MousePerformanceAdapter {
  private enabled: boolean
  private active = false
  private settling = false
  private hasOrigin = false

  private candidateX: number | null = null
  private candidateY: number | null = null

  private originX: number | null = null
  private originY: number | null = null

  private basePitch = 0
  private baseMod = 0
  private pitchBend = 0
  private modulation = 0

  private lastPointerX: number | null = null
  private lastPointerY: number | null = null

  // 200px horizontal movement from origin = full +/-1.0 pitch bend
  // 150px vertical movement from origin = full 0.0..1.0 modulation
  private sensitivityX = 1 / 200
  private sensitivityY = 1 / 150

  private entryTimer: number | null = null
  private recenterTimer: number | null = null
  private recenterTimerStartTime: number | null = null
  private recenterCandidateX: number | null = null
  private recenterCandidateY: number | null = null

  private listeners = new Set<MousePerfListener>()

  constructor() {
    // Default ON for fine-pointer (mouse/trackpad), OFF for touch-only coarse pointer
    const isCoarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    this.enabled = stored !== null ? stored === 'true' : !isCoarse

    // Window blur & document visibility safety listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', () => this.handleWindowBlur())
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.handleWindowBlur()
      })
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled))
    } catch {
      // Storage unavailable
    }
    if (!enabled && this.active) {
      this.reset()
    } else {
      this.notify()
    }
  }

  getState(): MousePerfState {
    const elapsed = this.recenterTimerStartTime !== null ? Math.min(MOUSE_PERFORMANCE_RECENTER_DWELL_MS, performance.now() - this.recenterTimerStartTime) : 0
    return {
      enabled: this.enabled,
      active: this.active,
      settling: this.settling,
      hasOrigin: this.hasOrigin,
      candidateX: this.candidateX,
      candidateY: this.candidateY,
      originX: this.originX,
      originY: this.originY,
      recenterCandidateX: this.recenterCandidateX,
      recenterCandidateY: this.recenterCandidateY,
      recenterTimerRunning: this.recenterTimer !== null,
      recenterTimerElapsedMs: Math.round(elapsed),
      pitchBend: this.pitchBend,
      modulation: this.modulation,
      basePitch: this.basePitch,
      baseMod: this.baseMod,
      entryDwellMs: MOUSE_PERFORMANCE_ENTRY_DWELL_MS,
      recenterDwellMs: MOUSE_PERFORMANCE_RECENTER_DWELL_MS,
      dwellTolerancePx: MOUSE_PERFORMANCE_DWELL_TOLERANCE_PX,
      minDisplacementPx: MOUSE_PERFORMANCE_RECENTER_MIN_DISPLACEMENT_PX,
      lastPointerX: this.lastPointerX,
      lastPointerY: this.lastPointerY,
    }
  }

  subscribe(listener: MousePerfListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  handlePointerEnter(clientX: number, clientY: number): void {
    if (!this.enabled) return
    this.clearTimers()

    this.active = true
    this.settling = true
    this.hasOrigin = false
    this.candidateX = clientX
    this.candidateY = clientY
    this.lastPointerX = clientX
    this.lastPointerY = clientY
    this.originX = null
    this.originY = null
    this.basePitch = 0
    this.baseMod = 0
    this.pitchBend = 0
    this.modulation = 0

    this.startEntryDwellTimer()
    this.notify()
  }

  handlePointerMove(clientX: number, clientY: number): void {
    if (!this.enabled || !this.active) return
    this.lastPointerX = clientX
    this.lastPointerY = clientY

    // State 1: SETTLING CANDIDATE
    if (this.settling && this.candidateX !== null && this.candidateY !== null) {
      const dist = Math.hypot(clientX - this.candidateX, clientY - this.candidateY)
      if (dist > MOUSE_PERFORMANCE_DWELL_TOLERANCE_PX) {
        // Pointer moved beyond tolerance -> restart dwell timer at new candidate point
        this.candidateX = clientX
        this.candidateY = clientY
        this.startEntryDwellTimer()
        this.notify()
      }
      return
    }

    // State 2: ACTIVE WITH ORIGIN
    if (this.hasOrigin && this.originX !== null && this.originY !== null) {
      const deltaX = clientX - this.originX
      // Screen Y increases downwards; moving UP means clientY < originY (deltaY > 0)
      const deltaY = this.originY - clientY

      const nextPitch = Math.min(1, Math.max(-1, this.basePitch + deltaX * this.sensitivityX))
      const nextMod = Math.min(1, Math.max(0, this.baseMod + deltaY * this.sensitivityY))

      // Rounding micro-deltas to avoid sub-float noise
      const safePitch = Math.abs(nextPitch) < 0.001 ? 0 : Number(nextPitch.toFixed(4))
      const safeMod = Math.abs(nextMod) < 0.001 ? 0 : Number(nextMod.toFixed(4))

      const pitchChanged = safePitch !== this.pitchBend
      const modChanged = safeMod !== this.modulation

      if (pitchChanged || modChanged) {
        this.pitchBend = safePitch
        this.modulation = safeMod

        const bus = getNoteEventBus()
        const now = performance.now()

        if (pitchChanged) {
          bus.emit({ kind: 'pitch-bend', value: this.pitchBend, at: now })
        }
        if (modChanged) {
          bus.emit({ kind: 'modulation', value: this.modulation, at: now })
        }

        this.notify()
      }

      // Check mid-session re-centering candidate
      const distFromOrigin = Math.hypot(clientX - this.originX, clientY - this.originY)
      if (distFromOrigin >= MOUSE_PERFORMANCE_RECENTER_MIN_DISPLACEMENT_PX) {
        if (this.recenterCandidateX === null || this.recenterCandidateY === null) {
          this.recenterCandidateX = clientX
          this.recenterCandidateY = clientY
          this.startRecenterDwellTimer()
          this.notify()
        } else {
          const moveDist = Math.hypot(clientX - this.recenterCandidateX, clientY - this.recenterCandidateY)
          if (moveDist > 2) {
            // Pointer is actively moving -> restart recenter timer at latest position
            this.recenterCandidateX = clientX
            this.recenterCandidateY = clientY
            this.startRecenterDwellTimer()
            this.notify()
          }
        }
      } else if (this.recenterTimer !== null) {
        this.cancelRecenterTimer()
        this.notify()
      }
    }
  }

  handlePointerLeave(): void {
    if (!this.active) return
    this.reset()
  }

  handleWindowBlur(): void {
    if (this.active) {
      this.reset()
    }
  }

  reset(): void {
    this.clearTimers()
    const hadEffect = this.active || this.settling || this.hasOrigin || this.pitchBend !== 0 || this.modulation !== 0

    this.active = false
    this.settling = false
    this.hasOrigin = false
    this.candidateX = null
    this.candidateY = null
    this.originX = null
    this.originY = null
    this.basePitch = 0
    this.baseMod = 0
    this.pitchBend = 0
    this.modulation = 0
    this.lastPointerX = null
    this.lastPointerY = null

    if (hadEffect) {
      const bus = getNoteEventBus()
      const now = performance.now()
      bus.emit({ kind: 'pitch-bend', value: 0, at: now })
      bus.emit({ kind: 'modulation', value: 0, at: now })
    }

    this.notify()
  }

  private startEntryDwellTimer(): void {
    if (this.entryTimer !== null) {
      clearTimeout(this.entryTimer)
    }
    this.entryTimer = window.setTimeout(() => {
      this.entryTimer = null
      if (!this.active || !this.settling || this.candidateX === null || this.candidateY === null) return

      // Dwell period satisfied! Establish initial origin.
      this.originX = this.candidateX
      this.originY = this.candidateY
      this.hasOrigin = true
      this.settling = false
      this.basePitch = 0
      this.baseMod = 0
      this.pitchBend = 0
      this.modulation = 0
      this.notify()
    }, MOUSE_PERFORMANCE_ENTRY_DWELL_MS)
  }

  private startRecenterDwellTimer(): void {
    if (this.recenterTimer !== null) {
      clearTimeout(this.recenterTimer)
    }
    this.recenterTimerStartTime = performance.now()
    this.recenterTimer = window.setTimeout(() => {
      this.recenterTimer = null
      this.recenterTimerStartTime = null
      if (
        !this.active ||
        !this.hasOrigin ||
        this.recenterCandidateX === null ||
        this.recenterCandidateY === null
      ) {
        return
      }

      // Re-center dwell period satisfied! Establish new origin and initialize pitch & modulation to (0, 0).
      this.originX = this.recenterCandidateX
      this.originY = this.recenterCandidateY
      this.recenterCandidateX = null
      this.recenterCandidateY = null
      this.basePitch = 0
      this.baseMod = 0
      this.pitchBend = 0
      this.modulation = 0

      const bus = getNoteEventBus()
      const now = performance.now()
      bus.emit({ kind: 'pitch-bend', value: 0, at: now })
      bus.emit({ kind: 'modulation', value: 0, at: now })

      this.notify()
    }, MOUSE_PERFORMANCE_RECENTER_DWELL_MS)
  }

  private cancelRecenterTimer(): void {
    if (this.recenterTimer !== null) {
      clearTimeout(this.recenterTimer)
      this.recenterTimer = null
    }
    this.recenterTimerStartTime = null
    this.recenterCandidateX = null
    this.recenterCandidateY = null
  }

  private clearTimers(): void {
    if (this.entryTimer !== null) {
      clearTimeout(this.entryTimer)
      this.entryTimer = null
    }
    this.cancelRecenterTimer()
  }

  private notify(): void {
    const snapshot = this.getState()
    for (const listener of [...this.listeners]) {
      listener(snapshot)
    }
  }
}

let mousePerfInstance: MousePerformanceAdapter | null = null

export function getMousePerformanceAdapter(): MousePerformanceAdapter {
  if (!mousePerfInstance) {
    mousePerfInstance = new MousePerformanceAdapter()
  }
  return mousePerfInstance
}


