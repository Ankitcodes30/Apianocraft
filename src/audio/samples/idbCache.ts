/**
 * IndexedDB cache for raw (undecoded) sample bytes. Values are ArrayBuffers
 * keyed by instrument id + version + file id, so bumping an instrument's
 * manifest version transparently invalidates stale entries (versioned cache
 * keys). Corrupt entries are detected at decode time by the caller, which
 * deletes the key and re-fetches.
 */

const DB_NAME = 'apiano-samples'
const STORE = 'raw'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
  return dbPromise
}

export function cacheKey(def: { id: string; version: string }, fileId: string): string {
  return `${def.id}@${def.version}/${fileId}`
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = fn(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
      }),
  )
}

export async function idbGet(key: string): Promise<ArrayBuffer | undefined> {
  const value = await tx<ArrayBuffer | undefined>('readonly', (s) => s.get(key))
  return value
}

export async function idbPut(key: string, data: ArrayBuffer): Promise<void> {
  await tx('readwrite', (s) => s.put(data, key))
}

export async function idbDelete(key: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(key))
}

export async function idbClear(): Promise<void> {
  await tx('readwrite', (s) => s.clear())
}

export async function idbCount(): Promise<number> {
  return tx<number>('readonly', (s) => s.count())
}

/** Drop the whole cache (tests, "clear storage" UI). */
export async function idbReset(): Promise<void> {
  dbPromise = null
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}
