/**
 * Encodes 32-bit floating point PCM audio samples into a 16-bit stereo PCM WAV file.
 */
export function encodeWavFile(
  leftSamples: Float32Array,
  rightSamples: Float32Array,
  sampleRate: number,
): Uint8Array {
  const numChannels = 2
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample

  const dataLength = leftSamples.length * blockAlign
  const bufferLength = 44 + dataLength
  const buffer = new ArrayBuffer(bufferLength)
  const view = new DataView(buffer)

  function writeString(offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')

  // fmt Sub-chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true)  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true) // ByteRate
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data Sub-chunk
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  // Interleave and write 16-bit PCM samples
  let offset = 44
  for (let i = 0; i < leftSamples.length; i++) {
    const sLeft = Math.max(-1, Math.min(1, leftSamples[i]))
    const sRight = Math.max(-1, Math.min(1, rightSamples[i]))

    const valLeft = sLeft < 0 ? sLeft * 0x8000 : sLeft * 0x7fff
    const valRight = sRight < 0 ? sRight * 0x8000 : sRight * 0x7fff

    view.setInt16(offset, valLeft, true)
    view.setInt16(offset + 2, valRight, true)
    offset += 4
  }

  return new Uint8Array(buffer)
}

/**
 * Tap recorder that captures audio from an AudioNode into stereo PCM arrays.
 */
export class AudioBufferTap {
  private ctx: AudioContext
  private sourceNode: AudioNode
  private recorderNode: ScriptProcessorNode | null = null
  private leftChunks: Float32Array[] = []
  private rightChunks: Float32Array[] = []
  private recording = false

  constructor(ctx: AudioContext, sourceNode: AudioNode) {
    this.ctx = ctx
    this.sourceNode = sourceNode
  }

  start(): void {
    this.leftChunks = []
    this.rightChunks = []
    this.recording = true

    // 4096 buffer size, 2 input channels, 2 output channels
    this.recorderNode = this.ctx.createScriptProcessor(4096, 2, 2)
    this.recorderNode.onaudioprocess = (e) => {
      if (!this.recording) return
      const inputL = e.inputBuffer.getChannelData(0)
      const inputR = e.inputBuffer.getChannelData(1)
      this.leftChunks.push(new Float32Array(inputL))
      this.rightChunks.push(new Float32Array(inputR))
    }

    this.sourceNode.connect(this.recorderNode)
    this.recorderNode.connect(this.ctx.destination)
  }

  stop(): Uint8Array {
    this.recording = false
    if (this.recorderNode) {
      this.recorderNode.disconnect()
      this.recorderNode.onaudioprocess = null
      this.recorderNode = null
    }

    let totalLength = 0
    for (const chunk of this.leftChunks) {
      totalLength += chunk.length
    }

    const mergedLeft = new Float32Array(totalLength)
    const mergedRight = new Float32Array(totalLength)

    let offset = 0
    for (let i = 0; i < this.leftChunks.length; i++) {
      mergedLeft.set(this.leftChunks[i], offset)
      mergedRight.set(this.rightChunks[i], offset)
      offset += this.leftChunks[i].length
    }

    return encodeWavFile(mergedLeft, mergedRight, this.ctx.sampleRate)
  }
}
