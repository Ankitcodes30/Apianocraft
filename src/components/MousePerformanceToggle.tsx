import React, { useEffect, useState } from 'react'
import { getMousePerformanceAdapter } from '../performance/MousePerformanceAdapter'
import { Button } from './ui/button'

export const MousePerformanceToggle: React.FC = () => {
  const adapter = getMousePerformanceAdapter()
  const [enabled, setEnabled] = useState(() => adapter.isEnabled())

  useEffect(() => {
    return adapter.subscribe((s) => setEnabled(s.enabled))
  }, [adapter])

  const toggle = () => {
    adapter.setEnabled(!enabled)
  }

  return (
    <Button
      type="button"
      variant={enabled ? 'on' : 'outline'}
      size="sm"
      className="btn-mouse-perf text-xs gap-1 font-medium"
      onClick={toggle}
      title="Toggle Mouse Performance Pitch + Modulation Control"
      data-btn-mouse-perf
    >
      <span className="opacity-70">Mouse Express:</span>
      <span className="font-bold">{enabled ? 'ON' : 'OFF'}</span>
    </Button>
  )
}
