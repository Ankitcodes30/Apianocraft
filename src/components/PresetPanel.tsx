import React, { useEffect, useState } from 'react'
import { getEngine } from '../audio/AudioEngine'
import type { WorkstationPreset } from '../audio/types'

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
    <div className="panel preset-panel" data-testid="preset-panel">
      <div className="panel-header">
        <h3 className="panel-title">Workstation Presets</h3>
      </div>

      <div className="control-group">
        <label className="control-label">Active Preset</label>
        <select
          value={selectedId}
          onChange={handleSelectPreset}
          className="control-select"
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
        </select>
      </div>

      <div className="preset-actions">
        {!showSaveInput ? (
          <button
            className="btn-action"
            onClick={() => setShowSaveInput(true)}
            data-testid="save-preset-btn"
          >
            Save Current as User Preset
          </button>
        ) : (
          <div className="save-input-row">
            <input
              type="text"
              placeholder="Preset Name..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="control-input"
              data-testid="preset-name-input"
            />
            <button className="btn-small btn-primary" onClick={handleSavePreset} data-testid="confirm-save-preset">
              Save
            </button>
            <button className="btn-small" onClick={() => setShowSaveInput(false)}>
              Cancel
            </button>
          </div>
        )}

        {isUserPreset && (
          <button
            className="btn-action btn-danger"
            onClick={handleDeletePreset}
            data-testid="delete-preset-btn"
          >
            Delete User Preset
          </button>
        )}
      </div>
    </div>
  )
}
