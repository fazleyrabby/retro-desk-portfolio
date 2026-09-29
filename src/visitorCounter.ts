const endpoint = 'https://views.fazleyrabbi.xyz';
const project = 'retro-desk-portfolio';
const cacheKey = 'retro-desk-portfolio:visits';
const sessionKey = 'retro-desk-portfolio:visitTracked';

type Store = 'local' | 'session';

function read(store: Store, key: string): string | null {
  try { return (store === 'local' ? localStorage : sessionStorage).getItem(key); } catch { return null; }
}

function write(store: Store, key: string, value: string): void {
  try { (store === 'local' ? localStorage : sessionStorage).setItem(key, value); } catch { /* Storage can be disabled. */ }
}

function isPreview(): boolean {
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
    host.endsWith('.local') || location.port !== '';
}

function isAutomatedVisitor(): boolean {
  const agent = navigator.userAgent.toLowerCase();
  return navigator.webdriver || [
    'bot', 'spider', 'crawler', 'preview', 'lighthouse', 'headless',
    'playwright', 'puppeteer', 'selenium', 'curl', 'wget', 'uptime',
  ].some(word => agent.includes(word));
}

export async function initVisitorCounter(): Promise<void> {
  const counter = document.querySelector<HTMLElement>('#visitor-count');
  if (!counter) return;

  const saved = Number(read('local', cacheKey));
  const cached = Number.isSafeInteger(saved) && saved >= 0 ? saved : 0;
  counter.textContent = cached.toLocaleString();
  const track = !isPreview() && !isAutomatedVisitor() && read('session', sessionKey) !== 'true';
  if (track) write('session', sessionKey, 'true');

  try {
    const route = track ? 'hit' : 'get';
    const response = await fetch(`${endpoint}/api/${route}?project=${project}&key=visitors`, {
      signal: AbortSignal.timeout(4000), cache: 'no-store',
    });
    if (!response.ok) return;
    const data: unknown = await response.json();
    const views = (data as { views?: unknown }).views;
    if (typeof views !== 'number' || !Number.isSafeInteger(views) || views < 0) return;
    write('local', cacheKey, String(views));
    counter.textContent = views.toLocaleString();
  } catch { /* Keep the last known count when offline. */ }
}
