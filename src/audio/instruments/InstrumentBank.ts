import type { Instrument, InstrumentInfo, SampledBuffer } from './Instrument'
import { AudioEngineError } from '../errors'

export class InstrumentBank {
  private map = new Map<string, Instrument>()
  private initialized = new Set<string>()

  register(instrument: Instrument): void {
    this.map.set(instrument.info.id, instrument)
  }

  list(): InstrumentInfo[] {
    return [...this.map.values()].map((i) => i.info)
  }

  get(id: string): Instrument | undefined {
    return this.map.get(id)
  }

  async ensureInit(ctx: AudioContext, id: string): Promise<Instrument> {
    const instrument = this.map.get(id)
    if (!instrument) {
      throw new AudioEngineError('INSTRUMENT_LOAD_FAILED', `Unknown instrument: ${id}`)
    }
    if (!this.initialized.has(id)) {
      if (instrument.init) await instrument.init(ctx)
      this.initialized.add(id)
    }
    return instrument
  }

  async getBuffer(ctx: AudioContext, id: string, note: number, velocity: number): Promise<SampledBuffer> {
    const instrument = await this.ensureInit(ctx, id)
    return instrument.getBuffer(ctx, note, velocity)
  }
}
