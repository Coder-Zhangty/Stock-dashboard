import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useState } from 'react'

import { loadPresetPrompts, savePresetPrompts, type PresetPrompt } from '../../lib/presetPrompts'

export const PresetPrompts = () => {
  const [presets, setPresets] = useState<PresetPrompt[]>(() => loadPresetPrompts())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')

  const refreshPresets = useCallback(() => {
    const next = loadPresetPrompts()
    setPresets(next)
  }, [])

  const handleSave = useCallback(() => {
    savePresetPrompts(presets)
  }, [presets])

  const handleAdd = useCallback(() => {
    const text = newText.trim()
    if (!text) return
    const next: PresetPrompt = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text,
      order: presets.length,
    }
    const updated = [...presets, next]
    setPresets(updated)
    savePresetPrompts(updated)
    setNewText('')
    setAdding(false)
  }, [newText, presets])

  const handleDelete = useCallback(
    (id: string) => {
      const updated = presets.filter((p) => p.id !== id)
      setPresets(updated)
      savePresetPrompts(updated)
    },
    [presets],
  )

  const startEdit = useCallback((preset: PresetPrompt) => {
    setEditingId(preset.id)
    setEditText(preset.text)
  }, [])

  const commitEdit = useCallback(() => {
    const text = editText.trim()
    if (!text || !editingId) {
      setEditingId(null)
      setEditText('')
      return
    }
    const updated = presets.map((p) => (p.id === editingId ? { ...p, text } : p))
    setPresets(updated)
    savePresetPrompts(updated)
    setEditingId(null)
    setEditText('')
  }, [editText, editingId, presets])

  const moveUp = useCallback(
    (id: string) => {
      const idx = presets.findIndex((p) => p.id === id)
      if (idx <= 0) return
      const updated = [...presets]
      ;[updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]]
      const reordered = updated.map((p, i) => ({ ...p, order: i }))
      setPresets(reordered)
      savePresetPrompts(reordered)
    },
    [presets],
  )

  const moveDown = useCallback(
    (id: string) => {
      const idx = presets.findIndex((p) => p.id === id)
      if (idx < 0 || idx >= presets.length - 1) return
      const updated = [...presets]
      ;[updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]]
      const reordered = updated.map((p, i) => ({ ...p, order: i }))
      setPresets(reordered)
      savePresetPrompts(reordered)
    },
    [presets],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-[rgb(var(--text))]">预设提示词</h4>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg bg-[rgb(var(--accent))] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 transition"
        >
          <Plus size={12} />
          添加
        </button>
      </div>
      <p className="text-[11px] text-[rgb(var(--muted))]">自定义预设提示词将显示在对话空状态中，点击即可发送。</p>

      {adding && (
        <div className="flex gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="输入提示词内容..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
              if (e.key === 'Escape') { setAdding(false); setNewText('') }
            }}
            className="flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-[12px] text-[rgb(var(--text))] placeholder:text-[rgb(var(--subtle))] outline-none focus:border-[rgb(var(--accent))]"
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newText.trim()}
            className="rounded-lg bg-[rgb(var(--accent))] px-3 py-2 text-[11px] text-white hover:opacity-90 disabled:opacity-40 transition"
          >
            保存
          </button>
        </div>
      )}

      {presets.length === 0 && !adding && (
        <p className="text-[11px] text-[rgb(var(--subtle))] py-2">暂无自定义提示词，使用系统默认提示词。</p>
      )}

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {presets.map((preset, idx) => (
          <div
            key={preset.id}
            className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 group"
          >
            {editingId === preset.id ? (
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') { setEditingId(null); setEditText('') }
                }}
                onBlur={commitEdit}
                className="flex-1 rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 text-[12px] text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))]"
                autoFocus
              />
            ) : (
              <span className="flex-1 text-[12px] text-[rgb(var(--text))] truncate">{preset.text}</span>
            )}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => moveUp(preset.id)}
                disabled={idx === 0}
                className="p-1 text-[rgb(var(--subtle))] hover:text-[rgb(var(--text))] disabled:opacity-30"
                title="上移"
              >
                ↑
              </button>
              <button
                onClick={() => moveDown(preset.id)}
                disabled={idx === presets.length - 1}
                className="p-1 text-[rgb(var(--subtle))] hover:text-[rgb(var(--text))] disabled:opacity-30"
                title="下移"
              >
                ↓
              </button>
              <button
                onClick={() => startEdit(preset)}
                className="p-1 text-[rgb(var(--subtle))] hover:text-[rgb(var(--text))]"
                title="编辑"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => handleDelete(preset.id)}
                className="p-1 text-[rgb(var(--subtle))] hover:text-[rgb(var(--danger))]"
                title="删除"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
