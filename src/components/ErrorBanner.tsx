import { useEffect, useState } from 'react'
import { clearErrors, subscribeErrors, type AppErrorEntry } from '../utils/ErrorBus'

export function ErrorBanner() {
  const [errors, setErrors] = useState<readonly AppErrorEntry[]>([])

  useEffect(() => subscribeErrors(setErrors), [])

  if (errors.length === 0) return null

  return (
    <div className="errs" role="alert">
      {errors.map((e) => (
        <div key={e.id} className="err">
          [{e.level}] {e.message}
        </div>
      ))}
      <button type="button" className="btn" onClick={clearErrors}>
        Dismiss
      </button>
    </div>
  )
}
