export type EngineErrorCode =
  | 'WEB_AUDIO_UNSUPPORTED'
  | 'CONTEXT_CREATE_FAILED'
  | 'WORKLET_LOAD_FAILED'
  | 'INSTRUMENT_LOAD_FAILED'
  | 'RESUME_FAILED'

export class AudioEngineError extends Error {
  readonly code: EngineErrorCode

  constructor(code: EngineErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'AudioEngineError'
    this.code = code
  }
}
