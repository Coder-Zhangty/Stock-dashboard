import Prism from 'prismjs'

import { sanitizeHtml } from './sanitizeHtml'

import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'

const languageAliases: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  md: 'markdown',
  py: 'python',
  cxx: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

export const normalizeCodeLanguage = (language?: string) => {
  if (!language) return 'code'
  const normalized = language.trim().toLowerCase()
  return languageAliases[normalized] ?? normalized
}

export const highlightCode = (code: string, language?: string) => {
  const normalizedLanguage = normalizeCodeLanguage(language)
  const grammar = Prism.languages[normalizedLanguage]

  if (!grammar) {
    return {
      languageLabel: language || 'code',
      highlightedHtml: escapeHtml(code),
    }
  }

  return {
    languageLabel: normalizedLanguage,
    highlightedHtml: sanitizeHtml(Prism.highlight(code, grammar, normalizedLanguage)),
  }
}
