const ALLOWED_TAG_RE = /^<\/?(span|code|pre|br)\b[\s\S]*?\/?>$/i
const EVENT_HANDLER_RE = /\s+on\w+\s*=\s*"[^"]*"/gi
const JAVASCRIPT_URL_RE = /\s+href\s*=\s*"javascript:/gi

export const sanitizeHtml = (html: string): string => {
  return html
    .replace(EVENT_HANDLER_RE, '')
    .replace(JAVASCRIPT_URL_RE, ' data-removed-href="javascript:')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
}
