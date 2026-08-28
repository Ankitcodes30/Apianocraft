#!/usr/bin/env node
/**
 * Fetch the Salamander Grand Piano V3 subset (Alexander Holm, CC BY 3.0) used
 * by Apianocraft and generate the instrument manifest.
 *
 * VERIFIED SOURCE & LICENSE (see LICENSE.md):
 *   - Author:  Alexander Holm
 *   - Source:  https://github.com/sfzinstruments/SalamanderGrandPiano
 *   - License: CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)
 *              — irrevocable, permits commercial use and redistribution with
 *                attribution. The repo LICENSE file is the CC BY 3.0 legal
 *                text; README + FreePats mirror confirm the same.
 *   - Samples: Yamaha C5 concert grand, 48 kHz / 24-bit FLAC, recorded with
 *              two AKG C414 (AB pair). Sampled in minor thirds (30 zones,
 *              MIDI 21..108). 16 velocity layers; this build ships 2 layers
 *              (v1 soft, v16 loud).
 *   - Zone/offset data below is transcribed from the repo's Data/region.txt,
 *     Data/vel_01.txt, Data/vel_16.txt and Data/tune_nat.txt (tune = 0).
 *
 *   node scripts/fetch-grand-piano.mjs
 */
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(root, 'public', 'samples', 'grand-piano')
const REPO = 'https://github.com/sfzinstruments/SalamanderGrandPiano'
const RAW = 'https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/master'
const TREE_API = 'https://api.github.com/repos/sfzinstruments/SalamanderGrandPiano/git/trees/master?recursive=1'

const CONCURRENCY = 4
const RETRIES = 4

/** Transcribed from Data/region.txt (lokey, hikey, pitch_keycenter, sample). */
const ZONES = [
  [21, 22, 21, 'A0'], [23, 25, 24, 'C1'], [26, 28, 27, 'D#1'], [29, 31, 30, 'F#1'],
  [32, 34, 33, 'A1'], [35, 37, 36, 'C2'], [38, 40, 39, 'D#2'], [41, 43, 42, 'F#2'],
  [44, 46, 45, 'A2'], [47, 49, 48, 'C3'], [50, 52, 51, 'D#3'], [53, 55, 54, 'F#3'],
  [56, 58, 57, 'A3'], [59, 61, 60, 'C4'], [62, 64, 63, 'D#4'], [65, 67, 66, 'F#4'],
  [68, 70, 69, 'A4'], [71, 73, 72, 'C5'], [74, 76, 75, 'D#5'], [77, 79, 78, 'F#5'],
  [80, 82, 81, 'A5'], [83, 85, 84, 'C6'], [86, 88, 87, 'D#6'], [89, 91, 90, 'F#6'],
  [92, 94, 93, 'A6'], [95, 97, 96, 'C7'], [98, 100, 99, 'D#7'], [101, 103, 102, 'F#7'],
  [104, 106, 105, 'A7'], [107, 108, 108, 'C8'],
]

/** Data/vel_01.txt offsets (soft layer) — sample start offset in source frames. */
const OFF_SOFT = [481, 1388, 1059, 971, 356, 682, 711, 995, 894, 918, 883, 698, 714, 695, 662, 515, 609, 569, 638, 610, 599, 1071, 633, 674, 760, 556, 528, 665, 1058, 650]
/** Data/vel_16.txt offsets (loud layer). */
const OFF_LOUD = [1754, 2163, 1318, 1134, 699, 820, 788, 975, 917, 935, 870, 879, 839, 727, 690, 602, 664, 720, 707, 693, 1522, 626, 621, 620, 635, 554, 524, 771, 688, 716]

const SOURCE_RATE = 48000
const LAYERS = [
  { layer: 'v1', velLo: 1, velHi: 63, offsets: OFF_SOFT, note: 'soft' },
  { layer: 'v16', velLo: 64, velHi: 127, offsets: OFF_LOUD, note: 'loud' },
]

/**
 * On-disk / URL-safe name for a sample id. Sharp note names (D#, F#) must not
 * appear in file names: '#' is the URL fragment delimiter, which silently
 * breaks static servers that fall back to index.html (vite preview, etc.).
 * 's' is the SFZ convention for sharp (Ds = D-sharp). The manifest `id` keeps
 * the original 'D#1v1' spelling; only `path` (and the file name) are rewritten.
 */
const safeFileName = (fileId) => fileId.replace(/#/g, 's')

const LOG = (...a) => console.log(...a)

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'apianocraft-sample-fetcher' } })
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return r.json()
}

async function fetchBuffer(url, { signal } = {}) {
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

async function withRetry(fn, attempts) {
  let last
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i < attempts) await new Promise((r) => setTimeout(r, 600 * i))
    }
  }
  throw last
}

async function main() {
  LOG('Verifying source sizes against GitHub tree...')
  const tree = await fetchJson(TREE_API)
  const blobs = new Map(tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.size]))
  if (blobs.size === 0) throw new Error('Tree listing failed — no blobs found.')

  const files = []
  for (const [z, [loNote, hiNote, rootNote, name]] of ZONES.entries()) {
    for (const { layer, velLo, velHi, offsets } of LAYERS) {
      const fileId = `${name}${layer}`
      const rel = `Samples/${fileId}.flac`
      const size = blobs.get(rel)
      if (!size) throw new Error(`Sample not found in tree: ${rel}`)
      files.push({ fileId, noteName: name, layer, velLo, velHi, rootNote, loNote, hiNote, offset: offsets[z], size })
    }
  }

  const totalBytes = files.reduce((s, f) => s + f.size, 0)
  LOG(`Plan: ${files.length} files, ${(totalBytes / 1048576).toFixed(1)} MiB`)

  await mkdir(OUT_DIR, { recursive: true })

  const queue = [...files]
  let done = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const f = queue.shift()
      if (!f) return
      const outPath = path.join(OUT_DIR, `${safeFileName(f.fileId)}.flac`)
      try {
        const existing = await stat(outPath).catch(() => null)
        if (existing && existing.size === f.size) {
          LOG(`skip ${safeFileName(f.fileId)}.flac (${(f.size / 1048576).toFixed(2)} MiB)`)
        } else {
          const url = `${RAW}/${encodeURIComponent(`Samples/${f.fileId}.flac`)}`
          const buf = await withRetry(() => fetchBuffer(url), RETRIES)
          if (buf.length !== f.size) {
            throw new Error(`Size mismatch for ${f.fileId}.flac: got ${buf.length}, expected ${f.size}`)
          }
          await writeFile(outPath, buf)
          LOG(`ok   ${safeFileName(f.fileId)}.flac (${(f.size / 1048576).toFixed(2)} MiB)`)
        }
      } catch (err) {
        console.error(`FAIL ${f.fileId}.flac — ${err.message}`)
        process.exitCode = 1
      }
      done++
      LOG(`  [${done}/${files.length}]`)
    }
  })
  await Promise.all(workers)

  // ---- manifest ----
  const manifest = {
    id: 'grand-piano',
    name: 'Grand Piano',
    version: '1.0.0',
    kind: 'samples',
    sourceRateHz: SOURCE_RATE,
    description: 'Salamander Grand Piano V3 (Yamaha C5) — subset: 30 zones x 2 velocity layers.',
    license: {
      spdx: 'CC-BY-3.0',
      title: 'Creative Commons Attribution 3.0 Unported',
      author: 'Alexander Holm',
      source: REPO,
      attribution: 'Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0). Yamaha C5, AKG C414 AB pair, 48 kHz 24-bit.',
      redistribution: 'Permitted — including commercial use and public deployment — with attribution.',
      notice: 'Derived from the Salamander Grand Piano V3 SFZ instrument (github.com/sfzinstruments/SalamanderGrandPiano).',
    },
    files: files.map((f) => ({
      id: f.fileId,
      path: `grand-piano/${safeFileName(f.fileId)}.flac`,
      sizeBytes: f.size,
      sourceUrl: `${REPO}/blob/master/${encodeURIComponent(`Samples/${f.fileId}.flac`)}`,
    })),
    zones: files.map((f) => ({
      sample: f.fileId,
      loNote: f.loNote,
      hiNote: f.hiNote,
      rootNote: f.rootNote,
      velLo: f.velLo,
      velHi: f.velHi,
      offset: f.offset,
    })),
  }

  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  LOG(`Manifest written: ${path.join(OUT_DIR, 'manifest.json')}`)

  const attribution = `Apianocraft — Grand Piano instrument

Source: ${REPO}
Author: Alexander Holm
License: Creative Commons Attribution 3.0 Unported (CC BY 3.0)
         https://creativecommons.org/licenses/by/3.0/

These samples are a subset of the "Salamander Grand Piano V3" sample set
(Yamaha C5 concert grand, recorded with two AKG C414 microphones in an AB
pairing, 48 kHz 24-bit FLAC). The subset ships 30 note zones across the full
keyboard (sampled in minor thirds, MIDI 21..108) at 2 velocity layers.

Redistribution and public deployment are permitted under the CC BY 3.0
license provided this attribution is preserved. The samples are derived from
the SFZ instrument at the source URL above.
`
  await writeFile(path.join(OUT_DIR, 'ATTRIBUTION.txt'), attribution)
  LOG('Attribution written.')
  LOG(process.exitCode ? 'DONE WITH ERRORS' : 'DONE')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
