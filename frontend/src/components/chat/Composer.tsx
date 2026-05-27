import clsx from 'clsx'
import {
  ArrowUp,
  Paperclip,
  Sparkles,
  Square,
  Wand2,
  Workflow,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { ChatAttachment, UserPermissionPolicy } from '../../types/chat'
import type { LibraryItem } from '../../types/library'

type ComposerAction = 'research' | 'image' | 'agent' | null

interface ComposerProps {
  centered?: boolean
  showCapabilities?: boolean
  disabled?: boolean
  canStop?: boolean
  permissions: UserPermissionPolicy
  libraryItems: LibraryItem[]
  value: string
  onValueChange: (value: string) => void
  editingLabel?: string | null
  onCancelEdit?: () => void
  onStop?: () => void
  onUploadFiles: (files: File[]) => Promise<LibraryItem[]>
  onSend: (payload: { content: string; attachments: ChatAttachment[]; mode?: string | null }) => Promise<void>
}

const placeholderByLocale = {
  'zh-CN': '给 Aurora 发送消息',
  'en-US': 'Message Aurora',
  'ja-JP': 'Aurora にメッセージを送信',
  'es-ES': 'Enviar mensaje a Aurora',
} as const

const actionLabels = {
  'zh-CN': {
    upload: '上传文件',
    research: '深度研究',
    image: '创建图片',
    agent: '代理模式',
    editing: '正在编辑消息',
    cancel: '取消',
    attachmentPrompt: '请分析附件内容。',
    uploadFailed: '文件上传失败，请重试。',
    unsupportedFile: '暂不支持该文件类型。',
    fileTooLarge: '文件不能超过 10 MB。',
  },
  'en-US': {
    upload: 'Upload files',
    research: 'Deep research',
    image: 'Create image',
    agent: 'Agent mode',
    editing: 'Editing message',
    cancel: 'Cancel',
    attachmentPrompt: 'Please analyze the attached files.',
    uploadFailed: 'File upload failed. Please try again.',
    unsupportedFile: 'This file type is not supported.',
    fileTooLarge: 'Files must be 10 MB or smaller.',
  },
  'ja-JP': {
    upload: 'ファイルを追加',
    research: '深い調査',
    image: '画像を生成',
    agent: 'エージェント',
    editing: 'メッセージを編集中',
    cancel: 'キャンセル',
    attachmentPrompt: '添付ファイルを分析してください。',
    uploadFailed: 'アップロードに失敗しました。',
    unsupportedFile: 'このファイル形式は未対応です。',
    fileTooLarge: 'ファイルは 10 MB 以下にしてください。',
  },
  'es-ES': {
    upload: 'Subir archivos',
    research: 'Investigación profunda',
    image: 'Crear imagen',
    agent: 'Modo agente',
    editing: 'Editando mensaje',
    cancel: 'Cancelar',
    attachmentPrompt: 'Analiza los archivos adjuntos.',
    uploadFailed: 'No se pudo subir el archivo.',
    unsupportedFile: 'Este tipo de archivo no está permitido.',
    fileTooLarge: 'Los archivos deben pesar 10 MB o menos.',
  },
} as const

const allowedUploadExtensions = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'pdf',
  'csv',
  'xls',
  'xlsx',
  'doc',
  'docx',
  'txt',
  'md',
  'json',
  'py',
  'ts',
  'tsx',
  'js',
  'jsx',
  'html',
  'css',
])

const maxUploadSize = 10 * 1024 * 1024

const toAttachment = (item: LibraryItem): ChatAttachment => ({
  id: item.id,
  name: item.name,
  type: item.type,
  source: item.source,
})

export const Composer = ({
  centered = false,
  showCapabilities = false,
  disabled = false,
  canStop = false,
  permissions,
  libraryItems,
  value,
  onValueChange,
  editingLabel = null,
  onCancelEdit,
  onStop,
  onUploadFiles,
  onSend,
}: ComposerProps) => {
  const { locale } = useI18n()
  const copy = actionLabels[locale]
  const placeholder = placeholderByLocale[locale]
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [activeAction, setActiveAction] = useState<ComposerAction>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled
  const attachedIds = new Set(attachments.map((a) => a.id))
  const availableLibraryItems = libraryItems.filter((item) => !attachedIds.has(item.id))

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return

    element.style.height = '0px'
    const nextHeight = Math.min(Math.max(element.scrollHeight, 24), 128)
    element.style.height = `${nextHeight}px`
  }, [value])

  const capabilityItems: Array<{
    id: string
    icon: typeof Paperclip
    label: string
  }> = []

  if (permissions.allowLibraryUpload) {
    capabilityItems.push({
      id: 'upload',
      icon: Paperclip,
      label: copy.upload,
    })
  }

  if (permissions.allowDeepResearch) {
    capabilityItems.push({
      id: 'research',
      icon: Sparkles,
      label: copy.research,
    })
  }

  if (permissions.allowImageTools) {
    capabilityItems.push({
      id: 'image',
      icon: Wand2,
      label: copy.image,
    })
  }

  if (permissions.allowAgentMode) {
    capabilityItems.push({
      id: 'agent',
      icon: Workflow,
      label: copy.agent,
    })
  }

  const handleCapabilityClick = (actionId: string) => {
    if (actionId === 'upload') {
      fileInputRef.current?.click()
      return
    }

    if (actionId === 'research') {
      setActiveAction((current) => (current === 'research' ? null : 'research'))
      return
    }

    if (actionId === 'image') {
      setActiveAction((current) => (current === 'image' ? null : 'image'))
      return
    }

    if (actionId === 'agent') {
      setActiveAction((current) => (current === 'agent' ? null : 'agent'))
    }
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSend) {
        void submit()
      }
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    const invalidFile = files.find((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      return !allowedUploadExtensions.has(extension)
    })
    if (invalidFile) {
      setUploadError(`${invalidFile.name}: ${copy.unsupportedFile}`)
      event.target.value = ''
      return
    }

    const oversizedFile = files.find((file) => file.size > maxUploadSize)
    if (oversizedFile) {
      setUploadError(`${oversizedFile.name}: ${copy.fileTooLarge}`)
      event.target.value = ''
      return
    }

    try {
      setUploadError(null)
      const uploaded = await onUploadFiles(files)
      setAttachments((current) => [...current, ...uploaded.map(toAttachment)])
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : copy.uploadFailed)
    } finally {
      event.target.value = ''
    }
  }

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => current.filter((item) => item.id !== attachmentId))
  }

  const submit = async () => {
    const content = value.trim() || copy.attachmentPrompt
    if (!content || disabled) return

    const currentAttachments = attachments
    onValueChange('')
    setAttachments([])
    setActiveAction(null)
    await onSend({ content, attachments: currentAttachments, mode: activeAction })
  }

  return (
    <div
      className={clsx(
        'relative z-10 px-4 pb-5 pt-3 sm:px-8 sm:pb-8',
        centered ? 'mx-auto w-full max-w-[980px]' : '',
      )}
    >
      <div
        className={clsx(
          'mx-auto w-full max-w-[1120px]',
          centered ? 'max-w-[700px]' : 'max-w-[860px]',
        )}
      >
        {editingLabel ? (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2 text-[13px] shadow-sm">
            <div className="min-w-0">
              <p className="font-medium text-[rgb(var(--text))]">{copy.editing}</p>
              <p className="mt-0.5 line-clamp-1 text-[rgb(var(--muted))]">{editingLabel}</p>
            </div>
            {onCancelEdit ? (
              <button
                type="button"
                onClick={onCancelEdit}
                className="ml-4 shrink-0 rounded-full px-3 py-1 text-[12px] text-[rgb(var(--subtle))] transition hover:bg-white/[0.08] hover:text-[rgb(var(--text))]"
              >
                {copy.cancel}
              </button>
            ) : null}
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-[12px] shadow-sm"
              >
                <Paperclip size={12} className="text-[rgb(var(--subtle))]" />
                <span className="max-w-[180px] truncate text-[rgb(var(--text))]">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className="rounded-full p-0.5 text-[rgb(var(--subtle))] transition hover:bg-white/[0.08] hover:text-[rgb(var(--text))]"
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {uploadError ? (
          <div className="mb-3 rounded-xl border border-red-800/40 bg-red-950/20 px-3.5 py-2 text-[12px] text-red-400">
            {uploadError}
          </div>
        ) : null}

        <div
          className={clsx(
            'overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] shadow-md transition-all duration-200',
            isFocused
              ? 'border-[rgb(var(--accent))]/40 shadow-lg ring-2 ring-[rgb(var(--accent))]/10'
              : 'border-[rgb(var(--border))]',
          )}
        >
          <div className="flex min-h-[56px] items-end gap-2.5 px-4 py-2 sm:min-h-[52px] sm:items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || !permissions.allowLibraryUpload}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[rgb(var(--subtle))] transition hover:bg-white/[0.08] hover:text-[rgb(var(--text))] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={copy.upload}
            >
              <Paperclip size={16} />
            </button>

            <div className="flex min-w-0 flex-1 items-center">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={disabled}
                rows={1}
                placeholder={placeholder}
                className="max-h-[128px] min-h-[24px] w-full resize-none bg-transparent px-1 py-0.5 text-[15px] leading-6 text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--subtle))] disabled:cursor-not-allowed"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (canStop && onStop) {
                  onStop()
                  return
                }
                void submit()
              }}
              disabled={!canStop && !canSend}
              className={clsx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all duration-200',
                canStop
                  ? 'bg-[#1c1c1e] hover:bg-[#2c2c2e] active:scale-[0.96]'
                  : canSend
                    ? 'bg-[rgb(var(--accent))] shadow-sm hover:shadow-md active:scale-[0.96]'
                    : 'bg-[rgb(var(--border))] text-[rgb(var(--subtle))]',
              )}
              aria-label={canStop ? 'Stop generating' : 'Send message'}
            >
              {canStop ? <Square size={12} fill="currentColor" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>

        {showCapabilities && capabilityItems.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {capabilityItems.map((item) => {
              const Icon = item.icon
              const active =
                (item.id === 'research' && activeAction === 'research') ||
                (item.id === 'image' && activeAction === 'image') ||
                (item.id === 'agent' && activeAction === 'agent')

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleCapabilityClick(item.id)}
                  disabled={disabled}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] transition duration-200',
                    active
                      ? 'border-[rgba(96,165,250,0.25)] bg-[rgba(96,165,250,0.10)] text-ink'
                      : 'border-white/10 bg-white/[0.05] text-subtle hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.10] hover:text-ink active:translate-y-0',
                    disabled ? 'cursor-not-allowed opacity-45' : '',
                  )}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {/* Library items from prior uploads */}
        {availableLibraryItems.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-subtle/60 mr-0.5">{copy.fromLibrary}:</span>
            {availableLibraryItems.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => setAttachments((current) => [...current, toAttachment(item)])}
                className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.04] px-2.5 py-1 text-[11px] text-subtle hover:border-white/15 hover:bg-white/[0.08] hover:text-ink transition disabled:opacity-40"
                title={item.name}
              >
                <Paperclip size={10} />
                <span className="max-w-[160px] truncate">{item.name}</span>
              </button>
            ))}
            {availableLibraryItems.length > 6 && (
              <span className="text-[10px] text-subtle/60">
                +{availableLibraryItems.length - 6}
              </span>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.csv,.xls,.xlsx,.doc,.docx,.txt,.md,.json,.py,.ts,.tsx,.js,.jsx,.html,.css"
          hidden
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}
