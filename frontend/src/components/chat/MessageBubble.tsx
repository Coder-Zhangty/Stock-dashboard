import clsx from 'clsx'
import { Check, CircleAlert, Copy, ExternalLink, Paperclip, Pencil } from 'lucide-react'
import { Fragment, memo, useMemo, useState, type ReactNode } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import { highlightCode } from '../../lib/codeHighlight'
import type { ChatMessage } from '../../types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  onEdit?: (message: ChatMessage) => void
}

interface CodeBlockProps {
  blockKey: string
  language?: string
  code: string
  isStreaming?: boolean
}

const linkPattern = /(\[([^\]]+)\]\(([^)]+)\))/g

const renderInlineContent = (content: string, keyPrefix: string): ReactNode[] => {
  const segments = content.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)

  return segments.filter(Boolean).map((segment, index) => {
    if (segment.startsWith('`') && segment.endsWith('`')) {
      return (
        <code
          key={`${keyPrefix}-code-${index}`}
          className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-['IBM_Plex_Mono',monospace] text-[0.92em] text-ink"
        >
          {segment.slice(1, -1)}
        </code>
      )
    }

    if (segment.startsWith('**') && segment.endsWith('**')) {
      return (
        <strong key={`${keyPrefix}-strong-${index}`} className="font-semibold text-ink">
          {segment.slice(2, -2)}
        </strong>
      )
    }

    const linkMatch = segment.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={`${keyPrefix}-link-${index}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline items-center gap-0.5 text-[rgb(var(--accent))] underline decoration-[rgba(79,104,170,0.25)] underline-offset-2 transition hover:decoration-[rgb(var(--accent))]"
        >
          {linkMatch[1]}
          <ExternalLink size={11} className="ml-0.5 inline-block opacity-60" />
        </a>
      )
    }

    return <Fragment key={`${keyPrefix}-text-${index}`}>{segment}</Fragment>
  })
}

const renderParagraphLines = (lines: string[], keyPrefix: string) =>
  lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-line-${index}`}>
      {renderInlineContent(line, `${keyPrefix}-inline-${index}`)}
      {index < lines.length - 1 ? <br /> : null}
    </Fragment>
  ))

const isHorizontalRule = (line: string) => /^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)
const isHeading = (line: string) => /^\s*#{1,6}\s+/.test(line)
const isUnorderedList = (line: string) => /^\s*[-*•]\s+/.test(line)
const isOrderedList = (line: string) => /^\s*\d+\.\s+/.test(line)
const isBlockquote = (line: string) => /^\s*>\s?/.test(line)
const isStandaloneImage = (line: string) => /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/.test(line)
const isTableSeparator = (line: string) =>
  /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line)
const isTableRow = (line: string) => line.includes('|')

const parseTableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

const renderMarkdownTable = (lines: string[], keyPrefix: string) => {
  const [headerLine, , ...bodyLines] = lines
  const headers = parseTableCells(headerLine)
  const rows = bodyLines
    .map(parseTableCells)
    .filter((cells) => cells.some((cell) => cell.length > 0))

  return (
    <div
      key={`${keyPrefix}-table`}
      className="overflow-x-auto rounded-[22px] border border-white/8 bg-[#1e1e28] shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
    >
      <table className="min-w-full border-collapse text-left text-[14px] leading-7 text-ink">
        <thead className="bg-white/[0.03]">
          <tr>
            {headers.map((header, index) => (
              <th
                key={`${keyPrefix}-th-${index}`}
                className="border-b border-white/6 px-4 py-3 font-medium tracking-[-0.01em] text-ink"
              >
                {renderInlineContent(header, `${keyPrefix}-th-inline-${index}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={`${keyPrefix}-row-${rowIndex}`} className="align-top">
              {headers.map((_, cellIndex) => (
                <td
                  key={`${keyPrefix}-cell-${rowIndex}-${cellIndex}`}
                  className="border-b border-white/5 px-4 py-3 text-[14px] text-ink last:border-b-0"
                >
                  {renderInlineContent(
                    cells[cellIndex] ?? '',
                    `${keyPrefix}-cell-inline-${rowIndex}-${cellIndex}`,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const renderBlockquote = (lines: string[], keyPrefix: string) => {
  return (
    <div
      key={`${keyPrefix}-blockquote`}
      className="rounded-r-[18px] border-l-[3px] border-[rgba(96,165,250,0.30)] bg-[rgba(96,165,250,0.06)] px-4 py-3.5"
    >
      <div className="space-y-2 text-[15px] leading-8 tracking-[-0.01em] text-ink">
        {lines.map((line, index) => (
          <p key={`${keyPrefix}-blockquote-line-${index}`}>
            {renderInlineContent(
              line.replace(/^\s*>\s?/, ''),
              `${keyPrefix}-blockquote-inline-${index}`,
            )}
          </p>
        ))}
      </div>
    </div>
  )
}

const CodeBlock = ({ blockKey, language, code, isStreaming = false }: CodeBlockProps) => {
  const [copiedCode, setCopiedCode] = useState(false)
  const { languageLabel, highlightedHtml } = useMemo(
    () => highlightCode(code.trimEnd(), language),
    [code, language],
  )
  const highlightedLines = useMemo(() => {
    const html = highlightedHtml || ''
    return html.length ? html.split('\n') : ['']
  }, [highlightedHtml])
  const displayLanguage = languageLabel || language || 'code'

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code.trimEnd())
    setCopiedCode(true)
    window.setTimeout(() => setCopiedCode(false), 1200)
  }

  return (
    <div
      key={blockKey}
      className="aurora-code aurora-code-panel overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(30,30,42,0.98),rgba(24,24,36,0.96))] shadow-[0_18px_44px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <div className="flex items-center justify-between border-b border-white/6 bg-[linear-gradient(180deg,rgba(40,40,52,0.70),rgba(32,32,44,0.60))] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b6b]/70 shadow-[0_0_0_1px_rgba(15,23,42,0.04)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f8c555]/70 shadow-[0_0_0_1px_rgba(15,23,42,0.04)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#42c58a]/70 shadow-[0_0_0_1px_rgba(15,23,42,0.04)]" />
          <span className="ml-2 rounded-full border border-white/8 bg-white/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            {displayLanguage}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            void handleCopyCode()
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-subtle transition duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/[0.10] hover:text-ink active:translate-y-0"
          aria-label="Copy code"
        >
          {copiedCode ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
      <pre className="overflow-x-auto py-3 font-['IBM_Plex_Mono',monospace] text-[12.5px] leading-6 text-ink sm:text-[13px]">
        <code className="block min-w-max">
          {highlightedLines.map((line, index) => (
            <span key={`${blockKey}-line-${index}`} className="flex min-h-6">
              <span className="w-11 shrink-0 select-none border-r border-white/5 pr-3 text-right text-[11px] leading-6 text-subtle/60">
                {index + 1}
              </span>
              <span
                className="min-w-0 flex-1 px-4"
                dangerouslySetInnerHTML={{ __html: line || ' ' }}
              />
              {isStreaming && index === highlightedLines.length - 1 ? (
                <span className="-ml-3 inline-block animate-blink pr-4 text-accent">|</span>
              ) : null}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

const renderImageBlock = (alt: string, url: string, keyPrefix: string) => {
  return (
    <figure key={keyPrefix} className="overflow-hidden rounded-[20px] border border-white/8 bg-[#1e1e28]">
      <img
        src={url}
        alt={alt || 'Image'}
        loading="lazy"
        className="max-h-[480px] w-full object-contain"
      />
      {alt ? (
        <figcaption className="border-t border-white/5 px-4 py-2.5 text-center text-[12px] text-subtle">
          {alt}
        </figcaption>
      ) : null}
    </figure>
  )
}

const renderTextBlocks = (content: string, keyPrefix: string) => {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let index = 0
  let blockIndex = 0

  while (index < lines.length) {
    const line = lines[index].trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (isHorizontalRule(trimmed)) {
      blocks.push(
        <div
          key={`${keyPrefix}-hr-${blockIndex}`}
          className="my-1 h-px w-full bg-white/8"
        />,
      )
      blockIndex += 1
      index += 1
      continue
    }

    if (isHeading(trimmed)) {
      const headingMatch = trimmed.match(/^\s*(#{1,6})\s+(.*)$/)
      const level = headingMatch?.[1].length ?? 1
      const text = headingMatch?.[2] ?? trimmed.replace(/^\s*#{1,6}\s+/, '')
      const headingClass =
        level <= 2
          ? 'mt-1 text-[18px] font-semibold tracking-[-0.025em] text-ink'
          : level === 3
            ? 'mt-1 text-[17px] font-semibold tracking-[-0.02em] text-ink'
            : 'mt-1 text-[15px] font-semibold tracking-[-0.015em] text-ink'
      blocks.push(
        <h3
          key={`${keyPrefix}-heading-${blockIndex}`}
          className={headingClass}
        >
          {renderInlineContent(text, `${keyPrefix}-heading-inline-${blockIndex}`)}
        </h3>,
      )
      blockIndex += 1
      index += 1
      continue
    }

    if (isStandaloneImage(trimmed)) {
      const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (imageMatch) {
        blocks.push(renderImageBlock(imageMatch[1], imageMatch[2], `${keyPrefix}-image-${blockIndex}`))
        blockIndex += 1
      }
      index += 1
      continue
    }

    if (isBlockquote(trimmed)) {
      const quoteLines: string[] = []
      while (index < lines.length && isBlockquote(lines[index].trim())) {
        quoteLines.push(lines[index].trim())
        index += 1
      }

      blocks.push(renderBlockquote(quoteLines, `${keyPrefix}-blockquote-${blockIndex}`))
      blockIndex += 1
      continue
    }

    if (
      index + 1 < lines.length &&
      isTableRow(trimmed) &&
      isTableSeparator(lines[index + 1].trim())
    ) {
      const tableLines = [trimmed, lines[index + 1].trim()]
      index += 2

      while (index < lines.length) {
        const nextLine = lines[index].trim()
        if (!nextLine || !isTableRow(nextLine)) break
        tableLines.push(nextLine)
        index += 1
      }

      blocks.push(renderMarkdownTable(tableLines, `${keyPrefix}-table-${blockIndex}`))
      blockIndex += 1
      continue
    }

    if (isUnorderedList(trimmed)) {
      const items: string[] = []
      while (index < lines.length && isUnorderedList(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\s*[-*•]\s+/, ''))
        index += 1
      }

      blocks.push(
        <ul
          key={`${keyPrefix}-unordered-${blockIndex}`}
          className="space-y-2 pl-5 text-[15px] leading-8 text-ink marker:text-[rgba(25,122,88,0.82)]"
        >
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-unordered-item-${blockIndex}-${itemIndex}`}>
              {renderInlineContent(
                item,
                `${keyPrefix}-unordered-inline-${blockIndex}-${itemIndex}`,
              )}
            </li>
          ))}
        </ul>,
      )
      blockIndex += 1
      continue
    }

    if (isOrderedList(trimmed)) {
      const items: string[] = []
      while (index < lines.length && isOrderedList(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\s*\d+\.\s+/, ''))
        index += 1
      }

      blocks.push(
        <ol
          key={`${keyPrefix}-ordered-${blockIndex}`}
          className="space-y-2 pl-5 text-[15px] leading-8 text-ink marker:text-subtle"
        >
          {items.map((item, itemIndex) => (
            <li key={`${keyPrefix}-ordered-item-${blockIndex}-${itemIndex}`}>
              {renderInlineContent(
                item,
                `${keyPrefix}-ordered-inline-${blockIndex}-${itemIndex}`,
              )}
            </li>
          ))}
        </ol>,
      )
      blockIndex += 1
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const currentLine = lines[index].trimEnd()
      const currentTrimmed = currentLine.trim()
      if (
        !currentTrimmed ||
        isHorizontalRule(currentTrimmed) ||
        isHeading(currentTrimmed) ||
        isBlockquote(currentTrimmed) ||
        isUnorderedList(currentTrimmed) ||
        isOrderedList(currentTrimmed) ||
        isStandaloneImage(currentTrimmed) ||
        (index + 1 < lines.length &&
          isTableRow(currentTrimmed) &&
          isTableSeparator(lines[index + 1].trim()))
      ) {
        break
      }

      paragraphLines.push(currentTrimmed)
      index += 1
    }

    if (paragraphLines.length > 0) {
      blocks.push(
        <p
          key={`${keyPrefix}-paragraph-${blockIndex}`}
          className="text-[15px] leading-8 tracking-[-0.01em] text-ink [overflow-wrap:anywhere]"
        >
          {renderParagraphLines(
            paragraphLines,
            `${keyPrefix}-paragraph-lines-${blockIndex}`,
          )}
        </p>,
      )
      blockIndex += 1
      continue
    }

    index += 1
  }

  return blocks
}

const renderAssistantContent = (content: string, isStreaming: boolean) => {
  const blocks: ReactNode[] = []
  const codeFencePattern = /```([\w-]+)?\n?([\s\S]*?)```/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeFencePattern.exec(content)) !== null) {
    const [rawMatch, language = '', code] = match
    const precedingText = content.slice(lastIndex, match.index)

    if (precedingText.trim()) {
      blocks.push(...renderTextBlocks(precedingText, `text-${match.index}`))
    }

    blocks.push(<CodeBlock blockKey={`code-${match.index}`} language={language} code={code} />)

    lastIndex = match.index + rawMatch.length
  }

  const trailingText = content.slice(lastIndex)
  const openFenceMatch = trailingText.match(/([\s\S]*?)```([\w-]+)?\n?([\s\S]*)$/)
  const hasUnclosedCodeFence =
    !!openFenceMatch && !openFenceMatch[0].includes('```', openFenceMatch[1].length + 3)

  if (hasUnclosedCodeFence && openFenceMatch) {
    const [, precedingText, language = '', code = ''] = openFenceMatch

    if (precedingText.trim()) {
      blocks.push(...renderTextBlocks(precedingText, `text-trailing-${lastIndex}`))
    }

    blocks.push(
      <CodeBlock
        blockKey={`code-open-${lastIndex}`}
        language={language}
        code={code}
        isStreaming={isStreaming}
      />,
    )
  } else if (trailingText.trim()) {
    blocks.push(...renderTextBlocks(trailingText, `text-trailing-${lastIndex}`))
  }

  if (blocks.length === 0) {
    blocks.push(
      <p key="empty-stream" className="text-[15px] leading-8 tracking-[-0.01em] text-ink">
        {content || (isStreaming ? '...' : '')}
      </p>,
    )
  }

  if (isStreaming && !hasUnclosedCodeFence) {
    blocks.push(
      <span key="streaming-cursor" className="inline-block animate-blink text-accent">
        |
      </span>,
    )
  }

  return blocks
}

const MessageActions = ({
  isUser,
  hasUsage,
  usage,
  copied,
  onCopy,
  onEdit,
}: {
  isUser: boolean
  hasUsage: boolean
  usage?: ChatMessage['usage']
  copied: boolean
  onCopy: () => void
  onEdit?: () => void
}) => {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {!isUser && usage ? (
        <details className="mr-1 max-w-full text-[11px] leading-5 text-subtle">
          <summary className="cursor-pointer list-none rounded-full border border-white/8 bg-white/[0.06] px-2.5 py-1 transition hover:bg-white/[0.12]">
            <span className="break-all">{usage.model}</span>
            <span className="px-1.5">&middot;</span>
            <span>{usage.totalTokens.toLocaleString()} Token</span>
            <span className="px-1.5">&middot;</span>
            <span>${usage.estimatedCost.toFixed(4)}</span>
          </summary>
          <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5">input {usage.promptTokens.toLocaleString()}</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5">output {usage.completionTokens.toLocaleString()}</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5">total {usage.totalTokens.toLocaleString()}</span>
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5">cost ${usage.estimatedCost.toFixed(4)}</span>
          </div>
        </details>
      ) : null}

      <div className="flex items-center gap-1 opacity-100 transition duration-200 sm:opacity-0 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={onCopy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-white/[0.08] hover:text-ink"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        {isUser && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition hover:bg-white/[0.08] hover:text-ink"
          >
            <Pencil size={14} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

const arePropsEqual = (prev: MessageBubbleProps, next: MessageBubbleProps) => {
  const p = prev.message
  const n = next.message
  return (
    p.id === n.id &&
    p.content === n.content &&
    p.status === n.status &&
    p.role === n.role &&
    p.usage === n.usage &&
    prev.onEdit === next.onEdit
  )
}

export const MessageBubble = memo(function MessageBubble({ message, onEdit }: MessageBubbleProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isError = message.status === 'error'

  const assistantContent = useMemo(
    () => (!isUser && !isSystem ? renderAssistantContent(message.content, message.status === 'streaming') : null),
    [message.content, message.status, isUser, isSystem],
  )

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div
      className={clsx(
        'group animate-fade-up px-4 py-4 sm:px-10 sm:py-5 [content-visibility:auto]',
        isUser ? 'ml-auto w-full max-w-[1120px]' : 'max-w-[1120px]',
        isSystem ? 'py-3' : '',
      )}
    >
      <div className={clsx('flex gap-5', isUser ? 'justify-end' : 'justify-start')}>
        <div
          className={clsx(
            'min-w-0',
            isSystem
              ? 'max-w-[920px]'
              : isUser
                ? 'max-w-[min(89vw,560px)] xl:max-w-[640px]'
                : 'w-full max-w-[920px]',
          )}
        >
          {isSystem ? (
            <div className="mx-auto inline-flex max-w-full items-center gap-2.5 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3.5 py-2 shadow-sm">
              <span className="shrink-0 rounded-full bg-[rgb(var(--accent-soft))] px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--accent))]">已切换</span>
              <p className="text-[13px] leading-6 text-[rgb(var(--muted))]">
                {message.content}
              </p>
            </div>
          ) : null}

          {!isUser && !isSystem ? (
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className={clsx(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold',
                  isError
                    ? 'bg-red-900/30 text-red-400'
                    : 'bg-[rgb(var(--accent))] text-white',
                )}
              >
                {isError ? '!' : 'AI'}
              </div>
              <span
                className={clsx(
                  'text-[13px] font-medium',
                  isError ? 'text-[rgb(var(--danger))]' : 'text-[rgb(var(--text))]',
                )}
              >
                {isError ? t('chat.errorTitle') : t('chat.assistantName')}
              </span>
              {message.status === 'streaming' ? (
                <span className="flex items-center gap-1.5 text-[12px] text-[rgb(var(--subtle))]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgb(var(--accent))]" />
                  {t('chat.thinkingStatus')}
                </span>
              ) : null}
              {message.status === 'cancelled' ? (
                <span className="text-[12px] text-[rgb(var(--warning))]">
                  {t('chat.cancelledStatus')}
                </span>
              ) : null}
            </div>
          ) : null}

          {!isSystem ? (
            <div
            className={clsx(
              'min-w-0',
              isUser
                ? 'ml-auto rounded-2xl border border-blue-500/20 bg-gradient-to-b from-blue-500/15 to-blue-500/5 px-4 py-3 text-[rgb(var(--text))] sm:px-5 sm:py-3.5'
                : isError
                  ? 'rounded-2xl border border-red-800/40 bg-red-950/20 px-4 py-3.5 text-[rgb(var(--danger))]'
                  : 'rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3.5 text-[rgb(var(--text))] shadow-sm sm:px-5 sm:py-4',
            )}
          >
            {isError ? <CircleAlert size={16} className="mb-2" /> : null}
            {isUser ? (
              <div className="space-y-3">
                {message.attachments?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {message.attachments.map((attachment) => (
                      <span
                        key={attachment.id}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.06] px-2.5 py-1 text-[11px] text-subtle"
                      >
                        <Paperclip size={12} />
                        <span className="truncate text-ink">{attachment.name}</span>
                        {attachment.sizeLabel ? <span>{attachment.sizeLabel}</span> : null}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="whitespace-pre-wrap break-words text-[15px] leading-7 tracking-[-0.012em] sm:text-[16px] [overflow-wrap:anywhere]">
                  {message.content || (message.status === 'streaming' ? '...' : '')}
                  {message.status === 'streaming' ? (
                    <span className="ml-1 inline-block animate-blink text-accent">|</span>
                  ) : null}
                </p>
              </div>
            ) : (
              <div className="aurora-message-stack flex w-full max-w-full flex-col space-y-3.5 break-words sm:inline-flex sm:w-fit sm:max-w-[80ch] sm:space-y-5">
                {assistantContent}
              </div>
            )}
            </div>
          ) : null}

          {!isSystem && !isError && message.status !== 'streaming' && message.status !== 'cancelled' ? (
            <MessageActions
              isUser={isUser}
              hasUsage={!!message.usage}
              usage={message.usage}
              copied={copied}
              onCopy={handleCopy}
              onEdit={onEdit ? () => onEdit(message) : undefined}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}, arePropsEqual)
