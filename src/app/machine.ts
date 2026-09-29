import type { DeskObjectId } from '../scene';

export type Mode =
  | 'BOOT'
  | 'DESK'
  | 'CRT_FOCUS'
  | 'CRT_APP'
  | 'FLOPPY_FOCUS'
  | 'FLOPPY_LOADING'
  | 'PROJECT_VIEW'
  | 'NOTEBOOK_FOCUS'
  | 'NOTEBOOK_OPEN'
  | 'EXPERIMENT_LOADING'
  | 'EXPERIMENT_FULLSCREEN'
  | 'OBJECT_FOCUS';

export type CrtAppId = 'projects' | 'lab' | 'about' | 'contact' | 'project';
export type NotebookKind = 'writing' | 'career';

export interface ModeState {
  mode: Mode;
  object: DeskObjectId | null;
  projectId: string | null;
  app: CrtAppId | null;
  notebook: NotebookKind | null;
  articleSlug: string | null;
  experimentId: string | null;
}

const MODES: Mode[] = [
  'BOOT',
  'DESK',
  'CRT_FOCUS',
  'CRT_APP',
  'FLOPPY_FOCUS',
  'FLOPPY_LOADING',
  'PROJECT_VIEW',
  'NOTEBOOK_FOCUS',
  'NOTEBOOK_OPEN',
  'EXPERIMENT_LOADING',
  'EXPERIMENT_FULLSCREEN',
  'OBJECT_FOCUS',
];

/** Legal transitions. Focused content modes always keep a return path to the desk. */
const TRANSITIONS: Record<Mode, Mode[]> = {
  BOOT: ['DESK'],
  DESK: ['CRT_FOCUS', 'FLOPPY_FOCUS', 'NOTEBOOK_FOCUS', 'OBJECT_FOCUS', 'EXPERIMENT_LOADING'],
  CRT_FOCUS: ['DESK', 'CRT_APP'],
  CRT_APP: ['CRT_FOCUS', 'DESK', 'PROJECT_VIEW', 'EXPERIMENT_LOADING', 'EXPERIMENT_FULLSCREEN'],
  FLOPPY_FOCUS: ['DESK', 'FLOPPY_LOADING', 'PROJECT_VIEW'],
  FLOPPY_LOADING: ['PROJECT_VIEW', 'DESK'],
  PROJECT_VIEW: ['DESK', 'CRT_APP', 'EXPERIMENT_LOADING', 'EXPERIMENT_FULLSCREEN'],
  NOTEBOOK_FOCUS: ['DESK', 'NOTEBOOK_OPEN'],
  NOTEBOOK_OPEN: ['NOTEBOOK_FOCUS', 'DESK'],
  EXPERIMENT_LOADING: ['EXPERIMENT_FULLSCREEN', 'DESK'],
  EXPERIMENT_FULLSCREEN: ['DESK', 'EXPERIMENT_LOADING'],
  OBJECT_FOCUS: ['DESK'],
};

/** Modes where desk objects must not receive input. */
const LOCKED: Mode[] = [
  'BOOT',
  'FLOPPY_LOADING',
  'PROJECT_VIEW',
  'NOTEBOOK_OPEN',
  'EXPERIMENT_LOADING',
  'EXPERIMENT_FULLSCREEN',
];

const empty: ModeState = {
  mode: 'BOOT',
  object: null,
  projectId: null,
  app: null,
  notebook: null,
  articleSlug: null,
  experimentId: null,
};

export class ExperienceMachine {
  private current: ModeState = { ...empty };
  private listeners = new Set<(state: ModeState) => void>();

  get state(): ModeState {
    return { ...this.current };
  }

  get mode(): Mode {
    return this.current.mode;
  }

  /** Desk objects only respond while the machine is resting on the desk. */
  get deskInteractive(): boolean {
    return !LOCKED.includes(this.current.mode);
  }

  can(next: Mode): boolean {
    return TRANSITIONS[this.current.mode].includes(next);
  }

  transition(next: Mode, patch: Partial<Omit<ModeState, 'mode'>> = {}): boolean {
    if (!this.can(next)) {
      if (import.meta.env.DEV) {
        console.warn(`Illegal Retro Desk transition: ${this.current.mode} -> ${next}`);
      }
      return false;
    }
    this.current =
      next === 'DESK' || next === 'BOOT'
        ? { ...empty, ...patch, mode: next }
        : { ...this.current, ...patch, mode: next };
    this.emit();
    return true;
  }

  reset(): void {
    this.current = { ...empty, mode: 'DESK' };
    this.emit();
  }

  onChange(listener: (state: ModeState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.state;
    for (const listener of this.listeners) listener(snapshot);
  }
}

export const MODE_LIST = MODES;
