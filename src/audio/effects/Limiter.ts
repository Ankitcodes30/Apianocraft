import type { LimiterKind } from '../types'
import limiterWorkletUrl from '../worklets/limiter.worklet.js?url'

/**
 * Master-chain limiter. Prefers a custom lookahead peak limiter AudioWorklet
 * (defined in worklets/limiter.worklet.ts); falls back to a DynamicsCompressor
 * and finally to a plain gain node so audio never dies with the worklet.
 */
export class Limiter {
  private constructor(
    readonly node: AudioNode,
    readonly kind: LimiterKind,
  ) {}

  private clockSamples = 0
  private levelSamples = 0
  private levelPeak = 0

  private setClock(samples: number): void {
    this.clockSamples = samples
  }

  private setLevel(samples: number, peak: number): void {
    this.levelSamples = samples
    this.levelPeak = peak
  }

  /** Total samples rendered through the limiter (render-thread progress). */
  clock(): number {
    return this.clockSamples
  }

  /** Latest render position + max output amplitude of its 1024-sample window. */
  level(): { samples: number; peak: number } {
    return { samples: this.levelSamples, peak: this.levelPeak }
  }

  static async create(ctx: AudioContext): Promise<Limiter> {
    try {
      await ctx.audioWorklet.addModule(limiterWorkletUrl)
      const node = new AudioWorkletNode(ctx, 'peak-limiter', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 2,
        channelCountMode: 'explicit',
        outputChannelCount: [2],
        parameterData: { threshold: 0.95, attack: 0.002, release: 0.08 },
      })
      const limiter = new Limiter(node, 'worklet')
      node.port.onmessage = (e: MessageEvent) => {
        if (!e.data || typeof e.data.samples !== 'number') return
        limiter.setClock(e.data.samples)
        if (typeof e.data.peak === 'number') limiter.setLevel(e.data.samples, e.data.peak)
      }
      return limiter
    } catch (cause) {
      console.warn('[apianocraft] AudioWorklet limiter unavailable, using DynamicsCompressor fallback', cause)
      try {
        const comp = ctx.createDynamicsCompressor()
        comp.threshold.value = -6
        comp.knee.value = 6
        comp.ratio.value = 12
        comp.attack.value = 0.004
        comp.release.value = 0.25
        return new Limiter(comp, 'dynamics-compressor')
      } catch {
        console.warn('[apianocraft] DynamicsCompressor unavailable, running without limiter')
        return new Limiter(ctx.createGain(), 'none')
      }
    }
  }
}
