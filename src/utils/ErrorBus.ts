export interface AppErrorEntry {
  id: number
  level: 'error' | 'warn'
  message: string
  at: number
}

type Listener = (entries: readonly AppErrorEntry[]) => void

const MAX = 8
let entries: AppErrorEntry[] = []
let nextId = 1
const listeners = new Set<Listener>()

export function pushError(level: 'error' | 'warn', message: string): void {
  entries = [...entries.slice(-(MAX - 1)), { id: nextId++, level, message, at: Date.now() }]
  emit()
}

export function clearErrors(): void {
  entries = []
  emit()
}

export function subscribeErrors(listener: Listener): () => void {
  listeners.add(listener)
  listener(entries)
  return () => {
    listeners.delete(listener)
  }
}

function emit(): void {
  for (const listener of [...listeners]) listener(entries)
}
