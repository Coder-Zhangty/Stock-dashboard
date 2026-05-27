export interface PresetPrompt {
  id: string
  text: string
  order: number
}

const STORAGE_KEY = 'aurora-preset-prompts'

export const loadPresetPrompts = (): PresetPrompt[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p) => p && typeof p.text === 'string' && p.text.trim())
  } catch {
    return []
  }
}

export const savePresetPrompts = (prompts: PresetPrompt[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
}
