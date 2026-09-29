import type { Project } from '../data';
import {
  aboutView,
  contactView,
  crtDesktopView,
  experimentView,
  labView,
  projectView,
  projectsView,
} from './views';

export interface OverlayIntents {
  onBack: () => void;
  onCloseToDesk: () => void;
  onOpenApp: (app: string) => void;
  onOpenProject: (projectId: string) => void;
  onLaunchExperiment: (experimentId: string) => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Logical pixel size of the FAZLEY OS surface before it is mapped onto the monitor. */
export const SCREEN_WIDTH = 1000;
export const SCREEN_HEIGHT = 605;

export class Overlay {
  readonly root: HTMLDivElement;
  private readonly titleEl: HTMLElement;
  private readonly contentEl: HTMLElement;
  private readonly backButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly intents: OverlayIntents;
  private returnFocus: HTMLElement | null = null;
  private clockTimer = 0;
  private level: 'desktop' | 'app' = 'desktop';

  constructor(intents: OverlayIntents) {
    this.intents = intents;
    this.root = document.createElement('div');
    this.root.className = 'crt-screen-layer';
    this.root.hidden = true;
    this.root.style.width = `${SCREEN_WIDTH}px`;
    this.root.style.height = `${SCREEN_HEIGHT}px`;
    this.root.innerHTML = `
      <div class="screen-scanlines" aria-hidden="true"></div>
      <div class="screen-roll" aria-hidden="true"></div>
      <div class="screen-flicker" aria-hidden="true"></div>
      <div class="screen-sheen" aria-hidden="true"></div>
      <header class="screen-bar">
        <span class="screen-title" id="crt-title">FAZLEY OS</span>
        <div class="screen-actions">
          <button type="button" class="screen-btn" data-crt-back>Back</button>
          <button type="button" class="screen-btn screen-btn--primary" data-crt-close>Back to desk</button>
        </div>
      </header>
      <div class="screen-content" id="crt-content" tabindex="-1" role="region" aria-labelledby="crt-title"></div>`;
    document.body.append(this.root);

    this.titleEl = this.root.querySelector('#crt-title')!;
    this.contentEl = this.root.querySelector('#crt-content')!;
    this.backButton = this.root.querySelector('[data-crt-back]')!;
    this.closeButton = this.root.querySelector('[data-crt-close]')!;

    this.backButton.addEventListener('click', () => this.intents.onBack());
    this.closeButton.addEventListener('click', () => this.intents.onCloseToDesk());
    this.contentEl.addEventListener('click', this.onContentClick);
    this.root.addEventListener('keydown', this.onKeydown);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  get atTopLevel(): boolean {
    return this.level === 'desktop';
  }

  /** Place the surface onto the projected monitor quad (CSS matrix3d). */
  applyProjection(transform: string) {
    this.root.style.transform = transform;
  }

  private onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.intents.onBack();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...this.root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.offsetParent !== null,
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  private onContentClick = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-app],[data-project],[data-experiment],[data-lab-filter]',
    );
    if (!target) return;

    if (target.dataset.app) {
      this.intents.onOpenApp(target.dataset.app);
      return;
    }
    if (target.dataset.project) {
      this.intents.onOpenProject(target.dataset.project);
      return;
    }
    if (target.dataset.experiment) {
      this.intents.onLaunchExperiment(target.dataset.experiment);
      return;
    }
    if (target.dataset.labFilter) {
      this.filterLab(target.dataset.labFilter);
    }
  };

  private filterLab(kind: string) {
    this.contentEl.querySelectorAll<HTMLElement>('[data-lab-filter]').forEach((button) => {
      const active = button.dataset.labFilter === kind;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    this.contentEl.querySelectorAll<HTMLElement>('.lab-card').forEach((card) => {
      card.hidden = kind !== 'all' && card.dataset.labKind !== kind;
    });
  }

  private setView(title: string, html: string, level: 'desktop' | 'app', focus = true) {
    this.titleEl.textContent = title;
    this.contentEl.innerHTML = html;
    this.level = level;
    this.backButton.hidden = level === 'desktop';
    if (focus) this.focusContent();
    this.refreshClock();
  }

  private refreshClock() {
    window.clearInterval(this.clockTimer);
    const clock = this.contentEl.querySelector<HTMLElement>('#os-clock');
    if (!clock) return;
    this.clockTimer = window.setInterval(() => {
      clock.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }, 30_000);
  }

  open(returnFocus: HTMLElement | null) {
    if (this.isOpen) return;
    this.returnFocus = returnFocus ?? (document.activeElement as HTMLElement | null);
    this.root.hidden = false;
    requestAnimationFrame(() => this.root.classList.add('is-live'));
    this.focusContent();
  }

  showDesktop() {
    this.setView('FAZLEY OS', crtDesktopView(), 'desktop');
  }

  showApp(app: string) {
    switch (app) {
      case 'projects':
        this.setView('Projects', projectsView(), 'app');
        break;
      case 'lab':
        this.setView('Lab', labView(), 'app');
        break;
      case 'about':
        this.setView('About', aboutView(), 'app');
        break;
      case 'contact':
        this.setView('Contact', contactView(), 'app');
        break;
      default:
        this.showDesktop();
        return;
    }
  }

  showProject(project: Project) {
    this.setView(project.title, projectView(project), 'app');
  }

  showExperiment(experiment: Project) {
    this.setView(`${experiment.title} — Lab`, experimentView(experiment), 'app');
  }

  showLab() {
    this.showApp('lab');
  }

  close() {
    if (!this.isOpen) return;
    window.clearInterval(this.clockTimer);
    this.root.classList.remove('is-live');
    const finish = () => {
      this.root.hidden = true;
      this.returnFocus?.focus({ preventScroll: true });
      this.returnFocus = null;
    };
    window.setTimeout(finish, 200);
  }

  private focusContent() {
    const target = this.contentEl.querySelector<HTMLElement>('h3, button, a, summary') ?? this.contentEl;
    target.focus({ preventScroll: true });
  }
}
