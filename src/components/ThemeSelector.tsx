import { useEffect, useState } from 'react'
import { getThemeManager, type ThemeMode } from '../theme/ThemeManager'
import { Select } from './ui/select'

export function ThemeSelector() {
  const manager = getThemeManager()
  const [mode, setMode] = useState<ThemeMode>(() => manager.getPreference())

  useEffect(() => {
    return manager.subscribe((_effective, currentMode) => {
      setMode(currentMode)
    })
  }, [manager])

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium select-none" title="Select Application Theme">
      <span className="text-[11px] font-semibold">Theme:</span>
      <Select
        aria-label="Application Theme"
        data-theme-select
        value={mode}
        onChange={(e) => manager.setPreference(e.currentTarget.value as ThemeMode)}
        className="h-7 w-28 text-xs"
      >
        <option value="system">System Default</option>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </Select>
    </label>
  )
}
