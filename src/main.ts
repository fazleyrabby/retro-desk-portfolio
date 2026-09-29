import './style.css';
import { Experience, type ExperienceState, type Hit } from './Experience';
import type { DeskObjectId } from './scene';
import { DeskAmbience } from './ambience';
import { initVisitorCounter } from './visitorCounter';
import { ExperienceMachine } from './app/machine';
import { UiSound } from './app/uiSound';
import { Overlay, SCREEN_HEIGHT, SCREEN_WIDTH } from './ui/overlay';
import { Book } from './ui/book';
import { experiments, featuredDiskById, featuredDisks, projectById } from './data';
import { externalLink } from './ui/html';

const app = document.querySelector<HTMLDivElement>('#app')!;

const descriptions: Record<DeskObjectId, { name: string; caption: string }> = {
  crt: { name: 'The computer', caption: 'FAZLEY OS — projects, the lab, about, and contact all live inside.' },
  tower: { name: 'The tower', caption: 'A proper beige case with the floppy drive that loads a project.' },
  keyboard: { name: 'The keyboard', caption: 'Well-worn keys and long evenings spent making things work.' },
  floppy: { name: 'Project disks', caption: 'Four featured projects, one disk each. Insert a disk to load it.' },
  notebook: { name: 'Field notes', caption: 'Two books: writing on the left, career history on the right.' },
  window: { name: 'Beyond the window', caption: 'Rain traces the glass while the wooded hills fade into the evening.' },
  lamp: { name: 'Desk lamp', caption: 'A little warmth for the long hours. Click to switch it on or off.' },
  fan: { name: 'Desk fan', caption: 'A little movement for the air on long summer nights.' },
  phone: { name: 'Desk phone', caption: 'An old line, always ready for a new conversation.' },
};

const overlayObjects: DeskObjectId[] = ['crt', 'floppy', 'notebook'];

app.innerHTML = `
  <main class="experience" aria-label="Fazley's interactive retro desk">
    <canvas id="desk-canvas" aria-label="Interactive 3D desk scene"></canvas>
    <div class="loading-screen" id="loading-screen" role="status"><span>FAZLEY SYSTEMS</span><strong>Preparing the desk...</strong></div>
    <div class="grain" aria-hidden="true"></div>
    <header class="masthead">
      <div class="brand-mark" aria-hidden="true">F<span>.</span></div>
      <div class="masthead-copy"><strong>FAZLEY'S DESK</strong><span>an interactive workspace</span></div>
      <div class="masthead-right">
        <span class="visitor-counter" title="Total visits"><span class="visitor-counter-dot" aria-hidden="true"></span><span class="visitor-label">VISITS</span><span id="visitor-count" aria-live="polite">0</span></span>
        <button class="sound-toggle" id="sound-toggle" type="button" aria-pressed="false" aria-label="Turn on ambient sound">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-3v10l-4-3H3z"/><path class="sound-wave" d="M13 7c1.2.7 1.8 1.7 1.8 3S14.2 12.3 13 13m2-8c2 1.2 3 2.9 3 5s-1 3.8-3 5"/></svg>
          <span class="sound-label">SOUND OFF</span>
        </button>
        <button class="help-toggle" id="help-toggle" type="button" aria-expanded="false" aria-controls="help-panel">HELP</button>
      </div>
    </header>
    <section class="intro" aria-label="Introduction">
      <p class="eyebrow">COME ON IN</p>
      <h1>Welcome to<br><em>my desk.</em></h1>
      <p class="intro-copy">Take a closer look. Every object is part of the story.</p>
    </section>
    <div class="hover-label" id="hover-label" aria-hidden="true"></div>
    <div class="object-card" id="object-card" hidden>
      <span class="object-kicker">ON THE DESK</span>
      <h2 id="object-title"></h2>
      <p id="object-caption"></p>
      <button class="back-button" id="back-button" type="button">Back to desk <span aria-hidden="true">↗</span></button>
    </div>
    <div class="help-panel" id="help-panel" role="dialog" aria-modal="false" aria-labelledby="help-title" hidden>
      <span class="object-kicker">HOW TO EXPLORE</span>
      <h2 id="help-title">Getting around the desk</h2>
      <ul>
        <li><strong>Click or tap</strong> an object, or use the buttons along the bottom.</li>
        <li>The <strong>computer</strong> opens FAZLEY OS: Projects, Lab, About, and Contact.</li>
        <li>Insert a <strong>project disk</strong> to load its project window.</li>
        <li>Open a <strong>notebook</strong> to read writing and career history.</li>
        <li><strong>Drag</strong> to look around the desk; <strong>scroll</strong> or pinch to zoom.</li>
        <li><strong>Escape</strong> or <strong>Back to desk</strong> always returns you here.</li>
      </ul>
      <button class="back-button" id="help-close" type="button">Close <span aria-hidden="true">✕</span></button>
    </div>
    <div class="view-controls" id="view-controls" role="group" aria-label="Desk view controls">
      <button type="button" data-view="in" aria-label="Zoom in">+</button>
      <button type="button" data-view="out" aria-label="Zoom out">−</button>
      <button type="button" data-view="reset" aria-label="Reset view">⟲</button>
    </div>
    <footer class="desk-footer">
      <div class="guide"><span class="guide-ring" aria-hidden="true"></span><span id="guide-copy">Choose an object to explore</span></div>
      <nav class="objects" aria-label="Explore desk objects">
        <button type="button" data-object="crt">Computer</button>
        <button type="button" data-object="floppy">Disks</button>
        <button type="button" data-object="notebook">Notebook</button>
        <button type="button" data-object="lamp">Lamp</button>
        <button type="button" data-object="window">Window</button>
        <button type="button" data-object="fan">Fan</button>
        <button type="button" data-object="phone">Phone</button>
      </nav>
      <div class="desk-footer-right">ESC TO RETURN</div>
    </footer>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#desk-canvas')!;
const card = document.querySelector<HTMLDivElement>('#object-card')!;
const title = document.querySelector<HTMLHeadingElement>('#object-title')!;
const caption = document.querySelector<HTMLParagraphElement>('#object-caption')!;
const guide = document.querySelector<HTMLSpanElement>('#guide-copy')!;
const hoverLabel = document.querySelector<HTMLDivElement>('#hover-label')!;
const back = document.querySelector<HTMLButtonElement>('#back-button')!;
const soundButton = document.querySelector<HTMLButtonElement>('#sound-toggle')!;
const soundLabel = soundButton.querySelector<HTMLSpanElement>('.sound-label')!;
const helpButton = document.querySelector<HTMLButtonElement>('#help-toggle')!;
const helpPanel = document.querySelector<HTMLDivElement>('#help-panel')!;
const helpClose = document.querySelector<HTMLButtonElement>('#help-close')!;
const viewControls = document.querySelector<HTMLDivElement>('#view-controls')!;
const ambience = new DeskAmbience();
const uiSound = new UiSound(() => ambience.enabled);
void initVisitorCounter();

const machine = new ExperienceMachine();
let experience: Experience;
let lastTrigger: HTMLElement | null = null;
let deskLocked = false;

const overlay = new Overlay({
  onBack: () => handleBack(),
  onCloseToDesk: () => closeToDesk(),
  onOpenApp: (nextApp) => openCrtApp(nextApp),
  onOpenProject: (projectId) => openProject(projectId),
  onLaunchExperiment: (experimentId) => launchExperiment(experimentId),
});

const book = new Book({
  onBack: () => handleNotebookBack(),
  onCloseToDesk: () => closeToDesk(),
});

function enter(mode: Parameters<ExperienceMachine['transition']>[0], patch: Parameters<ExperienceMachine['transition']>[1] = {}) {
  if (machine.mode === mode) return;
  if (!machine.can(mode) && machine.mode !== 'DESK' && machine.can('DESK')) machine.transition('DESK', {});
  machine.transition(mode, patch);
}

function lockDesk(locked: boolean) {
  deskLocked = locked;
  experience?.setInputLocked(locked);
  app.classList.toggle('is-reading', locked);
}

/** Run a camera move once the previous one has settled. */
function whenReady(action: () => void) {
  if (!experience || !experience.isMoving) { action(); return; }
  const tick = () => { if (!experience.isMoving) action(); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

interface Pt { x: number; y: number; }

// Projective transform helpers so the FAZLEY OS DOM surface lies on the monitor.
function adjugate(m: number[]): number[] {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}
function matMul(a: number[], b: number[]): number[] {
  const out = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let sum = 0;
    for (let k = 0; k < 3; k++) sum += a[i * 3 + k] * b[k * 3 + j];
    out[i * 3 + j] = sum;
  }
  return out;
}
function matVec(m: number[], v: number[]): number[] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}
function basis(p1: Pt, p2: Pt, p3: Pt, p4: Pt): number[] {
  const m = [p1.x, p2.x, p3.x, p1.y, p2.y, p3.y, 1, 1, 1];
  const v = matVec(adjugate(m), [p4.x, p4.y, 1]);
  return matMul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}
function quadMatrix(source: Pt[], target: Pt[]): number[] {
  const s = basis(source[0], source[1], source[2], source[3]);
  const d = basis(target[0], target[1], target[2], target[3]);
  return matMul(d, adjugate(s));
}

function positionScreenLayer() {
  if (!experience || !overlay.isOpen) return;
  const quad = experience.getScreenQuad();
  if (!quad) return;
  const camera = experience.camera;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const target: Pt[] = [];
  for (const corner of quad) {
    const view = corner.clone().applyMatrix4(camera.matrixWorldInverse);
    if (view.z > -0.05) { overlay.root.style.opacity = '0'; return; }
    const projected = corner.clone().project(camera);
    target.push({ x: (projected.x * 0.5 + 0.5) * width, y: (-projected.y * 0.5 + 0.5) * height });
  }
  overlay.root.style.opacity = '';
  const source: Pt[] = [
    { x: 0, y: 0 }, { x: SCREEN_WIDTH, y: 0 },
    { x: SCREEN_WIDTH, y: SCREEN_HEIGHT }, { x: 0, y: SCREEN_HEIGHT },
  ];
  const m = quadMatrix(source, target);
  const n = m.map((value) => value / m[8]);
  overlay.applyProjection(
    `matrix3d(${n[0]},${n[3]},0,${n[6]}, ${n[1]},${n[4]},0,${n[7]}, 0,0,1,0, ${n[2]},${n[5]},0,${n[8]})`,
  );
}

function openComputer() {
  lastTrigger = document.activeElement as HTMLElement;
  uiSound.click();
  enter('CRT_FOCUS', { object: 'crt' });
  whenReady(() => experience.focusObject('crt'));
  overlay.open(lastTrigger);
  overlay.showDesktop();
  lockDesk(true);
}

function openCrtApp(nextApp: string | null) {
  enter('CRT_APP', { object: 'crt', app: (nextApp as 'projects' | 'lab' | 'about' | 'contact' | null) ?? 'projects' });
  whenReady(() => experience.focusObject('crt'));
  overlay.open(lastTrigger);
  overlay.showApp(nextApp ?? 'projects');
  lockDesk(true);
}

function openProject(projectId: string) {
  const project = projectById(projectId);
  if (!project) return;
  enter('PROJECT_VIEW', { projectId });
  whenReady(() => experience.focusObject('crt'));
  overlay.open(lastTrigger);
  overlay.showProject(project);
  lockDesk(true);
}

function insertProject(projectId: string) {
  const project = featuredDiskById(projectId);
  if (!project) { openProject(projectId); return; }
  lastTrigger = document.activeElement as HTMLElement;
  enter('FLOPPY_FOCUS', { projectId });
  enter('FLOPPY_LOADING', { projectId });
  experience.insertDisk(projectId, () => {
    enter('PROJECT_VIEW', { projectId });
    experience.focusObject('crt');
    overlay.open(lastTrigger);
    overlay.showProject(project);
    lockDesk(true);
  });
}

function openDisks() {
  lastTrigger = document.activeElement as HTMLElement;
  uiSound.click();
  enter('FLOPPY_FOCUS', {});
  whenReady(() => {
    experience.focusObject('floppy');
    experience.spreadDisks(true);
  });
}

function openNotebookFocus() {
  lastTrigger = document.activeElement as HTMLElement;
  uiSound.click();
  enter('NOTEBOOK_FOCUS', { notebook: null });
  whenReady(() => {
    experience.focusObject('notebook');
    experience.spreadNotebooks(true);
  });
}

function openNotebook(kind: 'writing' | 'career') {
  lastTrigger = document.activeElement as HTMLElement;
  uiSound.click();
  enter('NOTEBOOK_FOCUS', { notebook: kind });
  enter('NOTEBOOK_OPEN', { notebook: kind });
  experience.focusObject('notebook');
  book.open(kind, lastTrigger);
  lockDesk(true);
}

function launchExperiment(experimentId: string) {
  const experiment = experiments.find((item) => item.id === experimentId);
  if (!experiment) return;
  const link = experiment.links.find((item) => item.label === 'Live') ?? experiment.links[0];
  enter('EXPERIMENT_LOADING', { experimentId });
  if (link) window.open(link.href, '_blank', 'noopener,noreferrer');
  enter('EXPERIMENT_FULLSCREEN', { experimentId });
  overlay.open(lastTrigger);
  overlay.showExperiment(experiment);
  lockDesk(true);
}

function closeToDesk() {
  const projectId = machine.state.projectId;
  if (machine.mode === 'PROJECT_VIEW' && projectId && experience.disks.has(projectId)) {
    experience.restoreDisk(projectId);
    uiSound.eject();
  }
  overlay.close();
  book.close();
  experience.spreadDisks(false);
  experience.spreadNotebooks(false);
  lockDesk(false);
  enter('DESK', {});
  experience.back();
}

function handleNotebookBack() {
  enter('NOTEBOOK_FOCUS', { notebook: machine.state.notebook });
  book.close();
  lockDesk(false);
}

function handleBack() {
  if (book.isOpen) { handleNotebookBack(); return; }
  switch (machine.mode) {
    case 'CRT_APP':
      enter('CRT_FOCUS', { object: 'crt' });
      overlay.showDesktop();
      return;
    default:
      closeToDesk();
  }
}

function handleActivate(hit: Hit) {
  if (!machine.deskInteractive) return;
  if (hit.id === 'crt') { openComputer(); return; }
  if (hit.id === 'floppy') {
    if (machine.mode === 'FLOPPY_FOCUS' && hit.projectId) insertProject(hit.projectId);
    else openDisks();
    return;
  }
  if (hit.id === 'notebook') {
    if (machine.mode === 'NOTEBOOK_FOCUS' && hit.notebookKind) openNotebook(hit.notebookKind);
    else openNotebookFocus();
    return;
  }
}

function render(state: ExperienceState) {
  const focused = state.focused;
  ambience.setFocus(focused);
  const isGeneric = focused !== null && !overlayObjects.includes(focused);
  app.classList.toggle('is-focused', Boolean(focused));
  card.hidden = !isGeneric;
  if (isGeneric) {
    title.textContent = descriptions[focused!].name;
    caption.textContent = descriptions[focused!].caption;
    guide.textContent = 'Use Escape or Back to return';
    enter('OBJECT_FOCUS', { object: focused });
  } else if (!focused) {
    guide.textContent = state.lampOn ? 'Choose an object to explore' : 'Lamp off. The room feels different.';
    if (lastTrigger && document.activeElement === back) lastTrigger.focus();
    if (!overlay.isOpen && !book.isOpen && ['OBJECT_FOCUS', 'FLOPPY_FOCUS', 'NOTEBOOK_FOCUS', 'CRT_FOCUS'].includes(machine.mode)) {
      enter('DESK', {});
    }
  } else if (focused === 'floppy') {
    guide.textContent = 'Click a disk to insert it · press 1–4';
  } else {
    guide.textContent = 'Click a book to open it · press 1 or 2';
  }
  if (!focused) {
    experience.spreadDisks(false);
    experience.spreadNotebooks(false);
  }
  hoverLabel.textContent = state.hoverLabel ?? (state.hovered ? descriptions[state.hovered].name : '');
  hoverLabel.classList.toggle('visible', Boolean(state.hovered && !focused));
  document.querySelectorAll<HTMLButtonElement>('[data-object]').forEach(button => {
    const id = button.dataset.object as DeskObjectId;
    button.setAttribute('aria-pressed', String(id === 'lamp' ? state.lampOn : id === focused));
  });
}

try {
  experience = new Experience(canvas, {
    onState: render,
    onReady: () => app.classList.add('assets-ready'),
    onActivate: handleActivate,
    onFrame: positionScreenLayer,
    onSound: (cue) => {
      if (cue === 'diskSlide') uiSound.diskSlide();
      else if (cue === 'diskSeat') uiSound.diskSeat();
      else uiSound.eject();
    },
  });
  machine.reset();
  render(experience.state);

  soundButton.addEventListener('click', async () => {
    soundButton.disabled = true;
    try {
      await ambience.setEnabled(!ambience.enabled);
      soundButton.setAttribute('aria-pressed', String(ambience.enabled));
      soundButton.setAttribute('aria-label', ambience.enabled ? 'Turn off ambient sound' : 'Turn on ambient sound');
      soundLabel.textContent = ambience.enabled ? 'SOUND ON' : 'SOUND OFF';
    } catch (error) {
      console.warn('Ambient audio is unavailable.', error);
      soundLabel.textContent = 'AUDIO UNAVAILABLE';
    } finally {
      soundButton.disabled = false;
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-object]').forEach(button => {
    button.addEventListener('click', () => {
      if (deskLocked) return;
      lastTrigger = button;
      experience.select(button.dataset.object as DeskObjectId);
      if (button.dataset.object !== 'lamp') back.focus({ preventScroll: true });
    });
  });

  back.addEventListener('click', () => closeToDesk());
  viewControls.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-view]');
    if (!button || deskLocked) return;
    if (button.dataset.view === 'in') experience.dolly(.85);
    else if (button.dataset.view === 'out') experience.dolly(1.18);
    else experience.resetView();
  });

  helpButton.addEventListener('click', () => toggleHelp(true));
  helpClose.addEventListener('click', () => toggleHelp(false));

  const toggledHelp = (): void => toggleHelp(!helpPanel.hidden);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !helpPanel.hidden) { toggledHelp(); return; }
    if (deskLocked) return;
    if (machine.mode === 'FLOPPY_FOCUS') {
      const index = Number(event.key);
      if (Number.isInteger(index) && index >= 1 && index <= featuredDisks.length) insertProject(featuredDisks[index - 1].id);
    } else if (machine.mode === 'NOTEBOOK_FOCUS') {
      if (event.key === '1') openNotebook('writing');
      else if (event.key === '2') openNotebook('career');
    }
  });
} catch (error) {
  console.error('Could not initialize the desk scene', error);
  canvas.remove();
  app.classList.add('no-webgl');
  app.classList.add('assets-ready');
  renderFallback();
}

function toggleHelp(open: boolean) {
  helpPanel.hidden = !open;
  helpButton.setAttribute('aria-expanded', String(open));
  if (open) helpClose.focus({ preventScroll: true });
  else helpButton.focus({ preventScroll: true });
}

function renderFallback() {
  document.querySelector('.intro-copy')!.textContent = 'The interactive desk needs WebGL. Everything is still readable below.';
  const objects = document.querySelector('.objects')!;
  const links = [
    externalLink('https://fazleyrabbi.xyz/', 'Portfolio'),
    externalLink('https://fazleyrabbi.xyz/projects/', 'Projects'),
    externalLink('https://fazleyrabbi.xyz/experiments/', 'Lab'),
    externalLink('https://fazleyrabbi.xyz/about/', 'About'),
    externalLink('mailto:fazley111@gmail.com', 'Contact'),
  ].join('');
  objects.innerHTML = links;
  document.querySelector('.guide')?.remove();
  const fallback = document.createElement('section');
  fallback.className = 'no-webgl-fallback';
  fallback.innerHTML = `
    <div class="no-webgl-links">${links}</div>`;
  app.append(fallback);
}
