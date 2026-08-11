/*
 * PeakLimiterProcessor — lookahead peak limiter AudioWorklet.
 *
 * MUST stay a self-contained plain-JS module (no imports, no TS syntax):
 * Vite emits `?url`-imported files as assets as-is, and AudioWorklet scopes
 * have no module graph. Hard-clip-safe last stage of the master chain.
 */

const FIXED_LOOKAHEAD_S = 0.005

class PeakLimiterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: 0.95, minValue: 0.01, maxValue: 1, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 0.002, minValue: 0.0001, maxValue: 0.05, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 0.08, minValue: 0.005, maxValue: 0.5, automationRate: 'k-rate' },
    ]
  }

  constructor(options) {
    super(options)
    const channels = typeof options?.channelCount === 'number' ? options.channelCount : 2
    this.delayLen = Math.max(1, Math.round(sampleRate * FIXED_LOOKAHEAD_S))
    this.delayBufs = []
    for (let c = 0; c < channels; c++) this.delayBufs.push(new Float32Array(this.delayLen))
    this.idx = 0
    this.env = 0
    this.gain = 1
    this.samplesProcessed = 0
    this.clockSent = 0
    this.windowPeak = 0
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input || input.length === 0 || !output || output.length === 0) return true

    const threshold = parameters.threshold[0]
    const attackC = Math.exp(-1 / Math.max(1, parameters.attack[0] * sampleRate))
    const releaseC = Math.exp(-1 / Math.max(1, parameters.release[0] * sampleRate))

    const chCount = Math.min(this.delayBufs.length, output.length)
    const n = output[0].length
    const readIdx = (this.idx + 1) % this.delayLen

    for (let i = 0; i < n; i++) {
      // Peak across channels
      let peak = 0
      for (let c = 0; c < chCount; c++) {
        const v = Math.abs((input[c] || input[0])[i])
        if (v > peak) peak = v
      }
      this.env = Math.max(peak, this.env * releaseC)
      const target = this.env > 1e-6 ? Math.min(1, threshold / this.env) : 1
      if (target < this.gain) this.gain = target + (this.gain - target) * attackC
      else this.gain = target + (this.gain - target) * releaseC

      for (let c = 0; c < chCount; c++) {
        const inCh = input[c] || input[0]
        const outCh = output[c]
        const delay = this.delayBufs[c]
        delay[this.idx] = inCh[i]
        const v = delay[readIdx] * this.gain
        outCh[i] = v
        const a = Math.abs(v)
        if (a > this.windowPeak) this.windowPeak = a
      }
    }
    this.idx = readIdx
    this.samplesProcessed += n
    // Render-thread progress + level clock for diagnostics: the page can read
    // the exact position of the rendered stream and the peak amplitude of each
    // 1024-sample window (analyser buffers can go stale when rendering stalls,
    // this cannot).
    if (this.samplesProcessed - this.clockSent >= 1024) {
      this.clockSent = this.samplesProcessed
      this.port.postMessage({ type: 'clock', samples: this.samplesProcessed, peak: this.windowPeak })
      this.windowPeak = 0
    }
    return true
  }
}

registerProcessor('peak-limiter', PeakLimiterProcessor)
