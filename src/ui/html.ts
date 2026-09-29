const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

const SAFE_PROTOCOL = /^(https?:|mailto:|tel:|#|\/)/i;

/** Only allow links the portfolio actually uses; reject script/data URLs. */
export function safeHref(href: string): string {
  const trimmed = href.trim();
  return SAFE_PROTOCOL.test(trimmed) ? trimmed : '#';
}

export function externalLink(href: string, label: string, className = 'link-external'): string {
  const url = safeHref(href);
  const external = /^https?:/i.test(url);
  const attributes = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a class="${className}" href="${escapeHtml(url)}"${attributes}>${escapeHtml(label)}${external ? ' <span aria-hidden="true">↗</span>' : ''}</a>`;
}
