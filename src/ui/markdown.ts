import { escapeHtml, safeHref } from './html';

/**
 * Small, dependency-free markdown renderer for portfolio copy and article text.
 * It intentionally supports only the constructs the Astro content uses and
 * escapes all HTML before formatting, so untrusted text cannot inject markup.
 */
export function renderMarkdown(markdown: string): string {
  const codeBlocks: string[] = [];
  const withPlaceholders = markdown.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_match, language: string, code: string) => {
    const index = codeBlocks.push(
      `<pre class="md-code"${language ? ` data-lang="${escapeHtml(language)}"` : ''}><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`,
    ) - 1;
    return `\u0000CODE${index}\u0000`;
  });

  const escaped = escapeHtml(withPlaceholders)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, href: string) => {
      const url = safeHref(href.replace(/&amp;/g, '&'));
      const external = /^https?:/i.test(url);
      return `<a class="md-link" href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    });

  const lines = escaped.split('\n');
  const output: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      output.push(`<p>${paragraph.join(' ')}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      output.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const codePlaceholder = line.match(/^\u0000CODE(\d+)\u0000$/);

    if (codePlaceholder) {
      flushParagraph();
      closeList();
      output.push(codeBlocks[Number(codePlaceholder[1])]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length + 1, 6);
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      output.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${inline((unordered || ordered)![1])}</li>`);
      continue;
    }

    paragraph.push(inline(line));
  }

  flushParagraph();
  closeList();
  return output.join('\n');
}

function inline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>');
}

export function plainExcerpt(markdown: string, limit = 150): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`[\]]/g, '')
    .replace(/\(([^)]*)\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit).replace(/\s+\S*$/, '')}…` : text;
}
