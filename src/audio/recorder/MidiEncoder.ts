import type { RecordedEvent } from './PerformanceRecorder'

/** 480 Ticks Per Quarter Note (TPQN). */
const TPQN = 480
/** 120 BPM = 500,000 microseconds per quarter note. */
const US_PER_QUARTER = 500000

function writeVlq(value: number): number[] {
  const bytes: number[] = []
  let v = Math.floor(Math.max(0, value))
  bytes.push(v & 0x7f)
  while ((v >>= 7) > 0) {
    bytes.unshift((v & 0x7f) | 0x80)
  }
  return bytes
}

function msToTicks(ms: number): number {
  // (ms / 1000) * (1000000 / US_PER_QUARTER) * TPQN
  return Math.round((ms / 1000) * (1000000 / US_PER_QUARTER) * TPQN)
}

/**
 * Encodes an array of recorded performance events into a Standard MIDI File
 * (SMF Type 0 binary `.mid`).
 */
export function encodeMidiFile(events: RecordedEvent[]): Uint8Array {
  const trackBytes: number[] = []

  // 1. Set Tempo Meta Event (120 BPM = 500,000 µs/qn)
  trackBytes.push(0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20) // 500,000 in hex

  let lastTicks = 0

  for (const ev of events) {
    const currentTicks = msToTicks(ev.timeMs)
    const deltaTicks = Math.max(0, currentTicks - lastTicks)
    lastTicks = currentTicks

    const vlqDelta = writeVlq(deltaTicks)
    trackBytes.push(...vlqDelta)

    switch (ev.type) {
      case 'noteOn': {
        const note = Math.max(0, Math.min(127, ev.note ?? 60))
        const vel = Math.max(1, Math.min(127, Math.round((ev.velocity ?? 0.8) * 127)))
        trackBytes.push(0x90, note, vel)
        break
      }
      case 'noteOff': {
        const note = Math.max(0, Math.min(127, ev.note ?? 60))
        trackBytes.push(0x80, note, 0)
        break
      }
      case 'sustain': {
        const val = ev.sustain ? 127 : 0
        trackBytes.push(0xb0, 0x40, val)
        break
      }
      case 'pitchBend': {
        // Value range -1..1 -> 0..16383 (center 8192)
        const bend = Math.max(0, Math.min(16383, Math.round(((ev.value ?? 0) + 1) * 8191.5)))
        const lsb = bend & 0x7f
        const msb = (bend >> 7) & 0x7f
        trackBytes.push(0xe0, lsb, msb)
        break
      }
      case 'modulation': {
        const val = Math.max(0, Math.min(127, Math.round((ev.value ?? 0) * 127)))
        trackBytes.push(0xb0, 0x01, val)
        break
      }
    }
  }

  // End of Track Meta Event
  trackBytes.push(0x00, 0xff, 0x2f, 0x00)

  // Construct MThd Header Chunk (14 bytes)
  const header = [
    0x4d, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // Header length (6)
    0x00, 0x00,             // Format 0
    0x00, 0x01,             // 1 Track
    (TPQN >> 8) & 0xff, TPQN & 0xff, // Division (480 TPQN)
  ]

  // Construct MTrk Track Chunk Header
  const trackLen = trackBytes.length
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b, // MTrk
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >> 8) & 0xff,
    trackLen & 0xff,
  ]

  const totalBuffer = new Uint8Array(header.length + trackHeader.length + trackBytes.length)
  totalBuffer.set(header, 0)
  totalBuffer.set(trackHeader, header.length)
  totalBuffer.set(trackBytes, header.length + trackHeader.length)

  return totalBuffer
}
