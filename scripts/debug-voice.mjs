/** One-off debug: why do some voices never end? */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 5199
const BASE = `http://localhost:${PORT}/`

const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const server = spawn(process.execPath, [viteCli, 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForServer() {
  for (let i = 0; i < 75; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch {}
    await sleep(400)
  }
  throw new Error('server not up')
}

const candidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const exe = candidates.find((c) => existsSync(c))

const browser = await puppeteer.launch({
  executablePath: exe,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--no-first-run', '--disable-gpu', '--window-size=1600,900'],
})
const page = await browser.newPage()
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))

await waitForServer()
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.waitForFunction(() => window.__apiano?.engine, { timeout: 20000 })

const r = await page.evaluate(async () => {
  const api = window.__apiano
  const engine = api.engine
  const snap = () => {
    const d = engine.getDiagnostics()
    return { active: d.activeVoices, stopped: d.totalStopped, started: d.totalStarted, notes: [...engine.getActiveNotes()] }
  }
  const out = []
  api.noteOn(60, 0.7)
  await new Promise((res) => setTimeout(res, 200))
  out.push(['after noteOn+200ms', snap()])
  api.noteOff(60)
  await new Promise((res) => setTimeout(res, 100))
  out.push(['after noteOff+100ms', snap()])
  await new Promise((res) => setTimeout(res, 600))
  out.push(['after noteOff+700ms', snap()])
  await new Promise((res) => setTimeout(res, 2500))
  out.push(['after +3.2s total', snap()])
  return out
})

console.log(JSON.stringify(r, null, 2))
console.log('--- console/page logs ---')
console.log(logs.slice(0, 30).join('\n'))
console.log('--- worklet fetch ---')
try {
  const page2 = await page.evaluate(async () => {
    const c = new AudioContext()
    const url = document.querySelector('script') && '/assets/' + (await (await fetch('/')).text()) ? '' : ''
    return 'n/a'
  })
  console.log(page2)
} catch (e) {
  console.log('err', e.message)
}

await browser.close()
server.kill()
process.exit(0)
