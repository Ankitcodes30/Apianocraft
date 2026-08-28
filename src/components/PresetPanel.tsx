import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { WorkstationPreset } from '../audio/types'
import { Card, CardHeader, CardContent } from './ui/card'
import { Select } from './ui/select'
import { Button } from './ui/button'

export const PresetPanel: React.FC = () => {
  const engine = getEngine()
  const [presets, setPresets] = useState<WorkstationPreset[]>([])
  const [selectedId, setSelectedId] = useState<string>('default-grand')
  const [presetName, setPresetName] = useState<string>('')
  const [showSaveInput, setShowSaveInput] = useState<boolean>(false)

  const refreshPresets = () => {
    setPresets(engine.getPresets())
  }

  useEffect(() => {
    setPresets(engine.getPresets())
  }, [engine])

  const handleSelectPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setSelectedId(id)
    void engine.loadPreset(id)
  }

  const handleSavePreset = () => {
    if (!presetName.trim()) return
    const created = engine.saveUserPreset(presetName.trim())
    setPresetName('')
    setShowSaveInput(false)
    refreshPresets()
    setSelectedId(created.id)
  }

  const handleDeletePreset = () => {
    if (!selectedId) return
    const success = engine.deleteUserPreset(selectedId)
    if (success) {
      refreshPresets()
      setSelectedId('default-grand')
      void engine.loadPreset('default-grand')
    }
  }

  const selectedPreset = presets.find((p) => p.id === selectedId)
  const isUserPreset = selectedPreset?.category === 'user'

  return (
    <Card className="panel preset-panel border-border" data-testid="preset-panel">
      <CardHeader className="panel-header p-3 pb-2">
        <h3 className="panel-title font-bold text-xs tracking-wider text-foreground">
          WORKSTATION PRESETS
        </h3>
      </CardHeader>

      <CardContent className="p-3 pt-0 flex flex-col gap-3">
        <div className="control-group flex flex-col gap-1 text-[11px] text-muted-foreground">
          <label className="control-label font-semibold">Active Preset</label>
          <Select
            value={selectedId}
            onChange={handleSelectPreset}
            className="control-select text-xs"
            data-testid="preset-select"
          >
            <optgroup label="Factory Presets">
              {presets
                .filter((p) => p.category === 'factory')
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
            {presets.some((p) => p.category === 'user') && (
              <optgroup label="User Presets">
                {presets
                  .filter((p) => p.category === 'user')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </Select>
        </div>

        <div className="preset-actions flex flex-col gap-2">
          {!showSaveInput ? (
            <Button
              variant="outline"
              size="sm"
              className="btn-action text-xs"
              onClick={() => setShowSaveInput(true)}
              data-testid="save-preset-btn"
            >
              Save Current as User Preset
            </Button>
          ) : (
            <div className="save-input-row flex gap-1.5 items-center">
              <input
                type="text"
                placeholder="Preset Name..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="control-input flex-1 h-8 rounded-md border border-border bg-card px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="preset-name-input"
              />
              <Button
                variant="default"
                size="sm"
                className="btn-small btn-primary text-xs"
                onClick={handleSavePreset}
                data-testid="confirm-save-preset"
              >
                Save
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="btn-small text-xs"
                onClick={() => setShowSaveInput(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          {isUserPreset && (
            <Button
              variant="destructive"
              size="sm"
              className="btn-action btn-danger text-xs"
              onClick={handleDeletePreset}
              data-testid="delete-preset-btn"
            >
              Delete User Preset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
