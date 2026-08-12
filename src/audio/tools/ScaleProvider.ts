export type ScaleType =
  | 'none'
  | 'major'
  | 'minor-natural'
  | 'minor-harmonic'
  | 'minor-melodic'
  | 'pentatonic-major'
  | 'pentatonic-minor'
  | 'blues'
  | 'dorian'
  | 'mixolydian'

export interface ScaleDefinition {
  id: ScaleType
  name: string
  intervals: number[]
}

export const SCALE_DEFINITIONS: ScaleDefinition[] = [
  { id: 'none', name: 'None (Off)', intervals: [] },
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor-natural', name: 'Natural Minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'minor-harmonic', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'minor-melodic', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'pentatonic-major', name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
  { id: 'pentatonic-minor', name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
  { id: 'blues', name: 'Blues Scale', intervals: [0, 3, 5, 6, 7, 10] },
  { id: 'dorian', name: 'Dorian Mode', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixolydian', name: 'Mixolydian Mode', intervals: [0, 2, 4, 5, 7, 9, 10] },
]

export const ROOT_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export interface ScaleHighlightState {
  rootKey: string
  scaleType: ScaleType
  rootPitchClass: number
  scalePitchClasses: Set<number>
}

export function getScaleHighlightState(rootKey: string, scaleType: ScaleType): ScaleHighlightState {
  const rootIdx = Math.max(0, ROOT_KEYS.indexOf(rootKey))
  const def = SCALE_DEFINITIONS.find((s) => s.id === scaleType) ?? SCALE_DEFINITIONS[0]

  const pitchClasses = new Set<number>()
  if (def.id !== 'none') {
    for (const interval of def.intervals) {
      pitchClasses.add((rootIdx + interval) % 12)
    }
  }

  return {
    rootKey,
    scaleType,
    rootPitchClass: rootIdx,
    scalePitchClasses: pitchClasses,
  }
}
