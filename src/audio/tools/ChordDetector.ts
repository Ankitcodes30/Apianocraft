const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export interface ChordResult {
  name: string
  root: string
  quality: string
  bass?: string
  notes: number[]
}

/**
 * Real-time chord detector. Analyzes active MIDI notes using pitch class set matching.
 */
export function detectChord(midiNotes: Iterable<number>): ChordResult | null {
  const sortedNotes = Array.from(midiNotes).sort((a, b) => a - b)
  if (sortedNotes.length < 2) return null

  const bassNote = sortedNotes[0]
  const bassPitchClass = bassNote % 12
  const bassName = PITCH_NAMES[bassPitchClass]

  // Extract unique pitch classes (0-11)
  const pitchClasses = Array.from(new Set(sortedNotes.map((n) => n % 12))).sort((a, b) => a - b)
  if (pitchClasses.length < 2) return null

  // Try each pitch class as potential root
  for (let r = 0; r < 12; r++) {
    const rootName = PITCH_NAMES[r]
    // Calculate intervals relative to candidate root r (0..11)
    const intervals = new Set(pitchClasses.map((pc) => (pc - r + 12) % 12))

    // Match interval patterns
    let quality = ''

    if (intervals.has(4) && intervals.has(7) && intervals.has(11)) {
      quality = 'maj7'
    } else if (intervals.has(4) && intervals.has(7) && intervals.has(10)) {
      quality = '7'
    } else if (intervals.has(3) && intervals.has(7) && intervals.has(10)) {
      quality = 'm7'
    } else if (intervals.has(3) && intervals.has(6) && intervals.has(10)) {
      quality = 'm7b5'
    } else if (intervals.has(3) && intervals.has(6) && intervals.has(9)) {
      quality = 'dim7'
    } else if (intervals.has(4) && intervals.has(7) && intervals.has(2)) {
      quality = 'add9'
    } else if (intervals.has(4) && intervals.has(7)) {
      quality = 'Major'
    } else if (intervals.has(3) && intervals.has(7)) {
      quality = 'Minor'
    } else if (intervals.has(3) && intervals.has(6)) {
      quality = 'dim'
    } else if (intervals.has(4) && intervals.has(8)) {
      quality = 'aug'
    } else if (intervals.has(2) && intervals.has(7)) {
      quality = 'sus2'
    } else if (intervals.has(5) && intervals.has(7)) {
      quality = 'sus4'
    }

    if (quality) {
      const isSlash = bassPitchClass !== r
      const qualityStr = quality === 'Major' || quality === 'Minor' ? ` ${quality}` : quality
      const chordName = isSlash ? `${rootName}${qualityStr}/${bassName}` : `${rootName} ${quality}`
      return {
        name: chordName.trim(),
        root: rootName,
        quality,
        bass: isSlash ? bassName : undefined,
        notes: sortedNotes,
      }
    }
  }

  // Fallback for interval pairs (dyads e.g. Perfect 5th, Octave)
  if (sortedNotes.length === 2) {
    const interval = Math.abs(sortedNotes[1] - sortedNotes[0]) % 12
    if (interval === 7) {
      return { name: `${bassName}5`, root: bassName, quality: '5th', notes: sortedNotes }
    }
  }

  return null
}
