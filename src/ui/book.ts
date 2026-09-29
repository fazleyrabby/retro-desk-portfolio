import { articles, career, loadArticleBody } from '../data';
import type { Article, CareerEntry } from '../data';
import { escapeHtml, externalLink } from './html';
import { renderMarkdown } from './markdown';

type BookKind = 'writing' | 'career';

interface BookItem {
  id: string;
  title: string;
  meta: string;
  tags: string[];
  render: () => string | Promise<string>;
  href?: string;
}

export interface BookIntents {
  onBack: () => void;
  onCloseToDesk: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function writingItems(): BookItem[] {
  return articles.map((article: Article) => ({
    id: article.slug,
    title: article.title,
    meta: `${formatDate(article.publishedAt)}${article.lang === 'bn' ? ' · বাংলা' : ''}`,
    tags: article.tags,
    render: async () => (await loadArticleBody(article.slug)) ?? article.excerpt,
    href: `${'https://fazleyrabbi.xyz'}${article.lang === 'bn' ? '/bn/posts' : '/posts'}/${encodeURIComponent(article.slug)}/`,
  }));
}

function careerItems(): BookItem[] {
  return career.map((entry: CareerEntry) => ({
    id: entry.id,
    title: entry.title,
    meta: `${entry.role} · ${entry.from} – ${entry.to}`,
    tags: entry.skills,
    render: () => entry.body,
  }));
}

/**
 * A physical, paper-reading counterpart to the notebook props. Content is
 * rendered on cream pages with an index leaf and prev/next page turns, so the
 * same information stays readable without relying on the 3D scene.
 */
export class Book {
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly tocEl: HTMLElement;
  private readonly detailEl: HTMLElement;
  private readonly counterEl: HTMLElement;
  private readonly numberLeft: HTMLElement;
  private readonly numberRight: HTMLElement;
  private readonly prevButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly tabButtons: HTMLButtonElement[];
  private readonly intents: BookIntents;
  private returnFocus: HTMLElement | null = null;
  private kind: BookKind = 'writing';
  private items: BookItem[] = [];
  private index = 0;
  private requestId = 0;

  constructor(intents: BookIntents) {
    this.intents = intents;
    this.root = document.createElement('div');
    this.root.className = 'book-overlay';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="book" role="dialog" aria-modal="true" aria-labelledby="book-title">
        <div class="book-cover">
          <div class="book-tabs" role="tablist" aria-label="Which notebook">
            <button type="button" role="tab" class="book-tab book-tab--writing" data-book-tab="writing" aria-selected="true">Writing</button>
            <button type="button" role="tab" class="book-tab book-tab--career" data-book-tab="career" aria-selected="false">Career</button>
          </div>
          <button type="button" class="book-close" data-book-close aria-label="Close notebook"><span aria-hidden="true">✕</span></button>
          <div class="book-pages">
            <section class="book-page book-page--left" aria-label="Contents">
              <h2 class="page-title" id="book-title">Field Notes</h2>
              <p class="page-kicker">A working notebook</p>
              <div class="book-toc" id="book-toc"></div>
              <span class="page-number page-number--left" id="book-number-left" aria-hidden="true">2</span>
            </section>
            <section class="book-page book-page--right" aria-label="Page">
              <article class="paper" id="book-detail" tabindex="-1"></article>
              <span class="page-number page-number--right" id="book-number-right" aria-hidden="true">3</span>
            </section>
          </div>
          <span class="book-stitch" aria-hidden="true"></span>
        </div>
        <footer class="book-foot">
          <button type="button" class="book-turn" data-book-prev>‹ Previous</button>
          <span class="book-counter" id="book-counter">—</span>
          <button type="button" class="book-turn" data-book-next>Next ›</button>
        </footer>
      </div>`;
    document.body.append(this.root);

    this.titleEl = this.root.querySelector('#book-title')!;
    this.tocEl = this.root.querySelector('#book-toc')!;
    this.detailEl = this.root.querySelector('#book-detail')!;
    this.counterEl = this.root.querySelector('#book-counter')!;
    this.numberLeft = this.root.querySelector('#book-number-left')!;
    this.numberRight = this.root.querySelector('#book-number-right')!;
    this.prevButton = this.root.querySelector('[data-book-prev]')!;
    this.nextButton = this.root.querySelector('[data-book-next]')!;
    this.tabButtons = [...this.root.querySelectorAll<HTMLButtonElement>('[data-book-tab]')];

    this.root.querySelector('[data-book-close]')!.addEventListener('click', () => this.intents.onCloseToDesk());
    this.prevButton.addEventListener('click', () => this.step(-1));
    this.nextButton.addEventListener('click', () => this.step(1));
    this.tocEl.addEventListener('click', this.onTocClick);
    this.tabButtons.forEach((button) =>
      button.addEventListener('click', () => this.setKind(button.dataset.bookTab === 'career' ? 'career' : 'writing')),
    );
    this.root.addEventListener('keydown', this.onKeydown);
  }

  private onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.intents.onBack();
      return;
    }
    if (event.key === 'ArrowRight') { this.step(1); return; }
    if (event.key === 'ArrowLeft') { this.step(-1); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...this.root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.offsetParent !== null && !element.hasAttribute('hidden'),
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  private onTocClick = (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-book-item]');
    if (!button) return;
    const next = this.items.findIndex((item) => item.id === button.dataset.bookItem);
    if (next >= 0) this.show(next);
  };

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(kind: BookKind, returnFocus: HTMLElement | null) {
    this.returnFocus = returnFocus ?? (document.activeElement as HTMLElement | null);
    if (this.isOpen) { this.setKind(kind); return; }
    this.root.hidden = false;
    requestAnimationFrame(() => this.root.classList.add('is-open'));
    this.setKind(kind);
  }

  close() {
    if (!this.isOpen) return;
    this.root.classList.remove('is-open');
    window.setTimeout(() => {
      this.root.hidden = true;
      this.returnFocus?.focus({ preventScroll: true });
      this.returnFocus = null;
    }, 240);
  }

  private setKind(kind: BookKind) {
    this.kind = kind;
    this.titleEl.textContent = kind === 'career' ? 'Work Log' : 'Field Notes';
    const kicker = this.root.querySelector('.page-kicker');
    if (kicker) kicker.textContent = kind === 'career' ? 'Positions & history' : 'Published writing';
    this.tabButtons.forEach((button) =>
      button.setAttribute('aria-selected', String(button.dataset.bookTab === kind)),
    );
    this.items = kind === 'career' ? careerItems() : writingItems();
    this.renderToc();
    this.show(0, true);
  }

  private renderToc() {
    this.tocEl.innerHTML = this.items
      .map(
        (item, i) => `
      <button type="button" class="book-toc-item${i === this.index ? ' is-active' : ''}" data-book-item="${escapeHtml(item.id)}">
        <span class="book-toc-title">${escapeHtml(item.title)}</span>
        <span class="book-toc-meta">${escapeHtml(item.meta)}</span>
      </button>`,
      )
      .join('');
  }

  private step(delta: number) {
    const next = Math.min(this.items.length - 1, Math.max(0, this.index + delta));
    if (next !== this.index) this.show(next);
  }

  private show(index: number, focus = false) {
    this.index = index;
    const item = this.items[index];
    if (!item) return;
    this.tocEl.querySelectorAll<HTMLElement>('[data-book-item]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.bookItem === item.id);
    });
    this.prevButton.disabled = index === 0;
    this.nextButton.disabled = index === this.items.length - 1;
    this.counterEl.textContent = `${index + 1} / ${this.items.length}`;
    this.numberLeft.textContent = String(index * 2 + 2);
    this.numberRight.textContent = String(index * 2 + 3);
    this.detailEl.classList.add('is-turning');
    const token = ++this.requestId;
    Promise.resolve(item.render()).then((markdown) => {
      if (token !== this.requestId) return;
      const tags = item.tags.length
        ? `<ul class="paper-tags">${item.tags.slice(0, 6).map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>`
        : '';
      const link = item.href ? `<p class="paper-foot">${externalLink(item.href, 'Read the published version', 'paper-link')}</p>` : '';
      this.detailEl.innerHTML = `
        <p class="paper-meta">${escapeHtml(item.meta)}</p>
        <h2 class="paper-title">${escapeHtml(item.title)}</h2>
        ${tags}
        <div class="paper-body">${renderMarkdown(markdown)}</div>
        ${link}`;
      this.detailEl.scrollTop = 0;
      this.detailEl.classList.remove('is-turning');
    });
    if (focus) this.detailEl.focus({ preventScroll: true });
  }

  get currentKind(): BookKind {
    return this.kind;
  }
}
