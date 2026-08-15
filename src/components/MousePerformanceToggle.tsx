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
      className={`btn-mouse-perf text-xs gap-1.5 font-medium ${enabled ? 'bg-[#5B7FA3] border-[#5B7FA3] text-white' : 'bg-[#292929] border-[#3A3A3A] text-[#D5D5D5]'}`}
      onClick={toggle}
      title="Toggle Mouse Performance Pitch + Modulation Control"
      data-btn-mouse-perf
    >
      <span className="opacity-80">Mouse Express:</span>
      <span className="font-semibold">{enabled ? 'ON' : 'OFF'}</span>
    </Button>
  )
}
