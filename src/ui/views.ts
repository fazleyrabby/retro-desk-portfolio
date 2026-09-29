import { about, experiments, featuredDisks, journey, profile, projects } from '../data';
import type { Project } from '../data';
import { escapeHtml, externalLink } from './html';
import { renderMarkdown } from './markdown';

const SITE = profile.url.replace(/\/$/, '');

function resumeHref(path: string): string {
  return path.startsWith('http') ? path : `${SITE}${path}`;
}

function tagList(items: string[], className = 'chip'): string {
  if (!items.length) return '';
  return `<ul class="chip-row">${items.map((item) => `<li class="${className}">${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function linkList(project: Project): string {
  if (!project.links.length) {
    return '<span class="muted">No public link recorded.</span>';
  }
  return project.links
    .map((link) => externalLink(link.href, link.label, 'app-link'))
    .join('');
}

function projectMeta(project: Project): string {
  const parts = [project.type, project.status, project.role, project.period].filter(Boolean) as string[];
  return parts.map((part) => `<span>${escapeHtml(part)}</span>`).join('<i class="dot" aria-hidden="true"></i>');
}

export function crtDesktopView(): string {
  const icons = [
    { app: 'projects', label: 'Projects', detail: `${projects.length} selected`, glyph: '▤' },
    { app: 'lab', label: 'Lab', detail: `${experiments.length} experiments`, glyph: '⚗' },
    { app: 'about', label: 'About', detail: 'Profile, path, résumé', glyph: '☰' },
    { app: 'contact', label: 'Contact', detail: 'Email & socials', glyph: '✉' },
  ];
  return `
    <div class="os-desktop">
      <div class="os-icons">
        ${icons
          .map(
            (icon) => `
          <button class="os-icon" type="button" data-app="${icon.app}" aria-label="Open ${icon.label}">
            <span class="os-icon-glyph" aria-hidden="true">${icon.glyph}</span>
            <span class="os-icon-label">${icon.label}</span>
            <span class="os-icon-detail">${icon.detail}</span>
          </button>`,
          )
          .join('')}
      </div>
      <div class="os-taskbar">
        <span class="os-start">FAZLEY OS <b>99</b></span>
        <span class="os-clock" id="os-clock">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>`;
}

export function projectsView(): string {
  return `
    <div class="app-body">
      <p class="app-lede">In production systems and shipped products. The four featured projects also have their own floppy disks on the desk.</p>
      <ol class="project-list">
        ${projects
          .map((project, index) => {
            const disk = featuredDisks.find((featured) => featured.id === project.id);
            return `
          <li class="project-item">
            <button class="project-open" type="button" data-project="${project.id}">
              <span class="project-index">${String(index + 1).padStart(2, '0')}${disk ? ' ◆' : ''}</span>
              <span class="project-open-main">
                <span class="project-title">${escapeHtml(project.title)}</span>
                <span class="project-sub">${escapeHtml(project.summary)}</span>
                ${tagList(project.stack.slice(0, 5))}
              </span>
            </button>
            <span class="project-links">${linkList(project)}</span>
          </li>`;
          })
          .join('')}
      </ol>
    </div>`;
}

export function projectView(project: Project): string {
  const sections = [
    ['Problem', project.problem],
    ['Solution', project.solution],
    ['Impact', project.impact],
  ].filter((entry) => entry[1]) as [string, string][];

  return `
    <div class="app-body project-detail">
      <p class="app-kicker">${escapeHtml(project.type)}</p>
      <h3 class="detail-title">${escapeHtml(project.title)}</h3>
      <p class="detail-meta">${projectMeta(project)}</p>
      <p class="app-lede">${escapeHtml(project.summary)}</p>
      ${sections
        .map(([heading, body]) => `<section class="detail-section"><h4>${heading}</h4><p>${escapeHtml(body)}</p></section>`)
        .join('')}
      ${project.highlights.length ? `<section class="detail-section"><h4>Highlights</h4><ul class="detail-list">${project.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
      ${project.scope.length ? `<section class="detail-section"><h4>Scope</h4><ul class="detail-list detail-list--tight">${project.scope.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
      <section class="detail-section"><h4>Stack</h4>${tagList(project.stack, 'chip chip--stack')}</section>
      <div class="detail-links">${linkList(project)}</div>
    </div>`;
}

export function labView(): string {
  const kinds = [
    { id: 'all', label: 'All' },
    { id: 'game', label: 'Games' },
    { id: 'webgl', label: '3D & WebGL' },
    { id: 'creative', label: 'Creative' },
    { id: 'web', label: 'Web' },
  ];
  return `
    <div class="app-body">
      <p class="app-lede">Playable games, real-time 3D worlds, shaders, and browser experiments. Launches open in a new tab; the desk stays right here.</p>
      <div class="lab-filters" role="group" aria-label="Filter experiments">
        ${kinds.map((kind, index) => `<button type="button" class="lab-filter${index === 0 ? ' is-active' : ''}" data-lab-filter="${kind.id}" aria-pressed="${index === 0}">${kind.label}</button>`).join('')}
      </div>
      <div class="lab-grid" id="lab-grid">
        ${experiments
          .map(
            (experiment) => `
          <article class="lab-card" data-lab-kind="${experiment.kind}">
            <p class="lab-kind">${escapeHtml(experiment.type)}</p>
            <h3 class="lab-title">${escapeHtml(experiment.title)}</h3>
            <p class="lab-desc">${escapeHtml(experiment.summary)}</p>
            ${tagList(experiment.stack.slice(0, 4))}
            <div class="detail-links">
              ${experiment.links.map((link) => externalLink(link.href, link.label === 'Live' ? 'Launch' : link.label, 'app-link')).join('')}
              <button type="button" class="app-link app-link--ghost" data-experiment="${experiment.id}">Load in desk view</button>
            </div>
          </article>`,
          )
          .join('')}
      </div>
    </div>`;
}

export function aboutView(): string {
  return `
    <div class="app-body about-view">
      <p class="app-kicker">${escapeHtml(profile.role)}</p>
      <p class="app-lede">${escapeHtml(profile.positioning)}</p>
      <p class="app-note">${escapeHtml(profile.description)}</p>
      <ul class="fact-row">
        <li><span>Based in</span><strong>${escapeHtml(`${profile.location.city}, ${profile.location.country}`)}</strong></li>
        <li><span>Experience</span><strong>${escapeHtml(profile.experience.claim)}</strong></li>
        <li><span>Availability</span><strong>${escapeHtml(profile.availability.headline)}</strong></li>
      </ul>
      ${tagList(profile.focus, 'chip chip--focus')}
      <article class="doc">${renderMarkdown(about.markdown)}</article>
      <div class="detail-section">
        <h4>Résumé</h4>
        <div class="detail-links">
          ${externalLink(resumeHref(profile.resume.pdf), 'Résumé (PDF)', 'app-link')}
          ${externalLink(resumeHref(profile.resume.cv), 'CV (PDF)', 'app-link')}
          ${externalLink(`${SITE}/resume`, 'Resume page', 'app-link')}
          ${externalLink(`${SITE}/journey`, 'Full journey', 'app-link')}
        </div>
      </div>
      <div class="about-cols">
        <section class="detail-section">
          <h4>Education</h4>
          <ul class="detail-list detail-list--tight">
            ${profile.education.map((item) => `<li><strong>${escapeHtml(item.institution)}</strong><span>${escapeHtml(item.credential)} · ${escapeHtml(item.year)}</span></li>`).join('')}
          </ul>
        </section>
        <section class="detail-section">
          <h4>Languages</h4>
          <ul class="detail-list detail-list--tight">
            ${profile.languages.map((item) => `<li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.level)}</span></li>`).join('')}
          </ul>
        </section>
      </div>
      <details class="journey-fold">
        <summary>Read the personal journey</summary>
        <article class="doc">${renderMarkdown(journey.markdown)}</article>
      </details>
    </div>`;
}

export function contactView(): string {
  return `
    <div class="app-body contact-view">
      <p class="app-lede">${escapeHtml(profile.availability.headline)}</p>
      <p class="app-note">${escapeHtml(profile.availability.detail)}</p>
      <div class="contact-primary">
        ${externalLink(`mailto:${profile.email}`, profile.email, 'contact-mail')}
      </div>
      <ul class="social-list">
        ${profile.socials
          .map((social) =>
            social.id === 'email'
              ? ''
              : `<li>${externalLink(social.href, social.label, 'social-link')}</li>`,
          )
          .join('')}
      </ul>
      <ul class="fact-row">
        <li><span>Location</span><strong>${escapeHtml(`${profile.location.city}, ${profile.location.country} (${profile.location.timezone})`)}</strong></li>
        <li><span>Remote</span><strong>${profile.location.remote ? 'Open to remote' : 'On-site'}</strong></li>
        <li><span>Focus</span><strong>${escapeHtml(profile.focus.join(' · '))}</strong></li>
      </ul>
    </div>`;
}

export function experimentView(experiment: Project): string {
  return `
    <div class="app-body experiment-view">
      <p class="app-kicker">${escapeHtml(experiment.type)}</p>
      <h3 class="detail-title">${escapeHtml(experiment.title)}</h3>
      <p class="app-lede">${escapeHtml(experiment.summary)}</p>
      <p class="app-note">Heavy experiments open in their own tab so the desk stays light. If the tab did not open, use the launch button below.</p>
      ${tagList(experiment.stack)}
      <div class="detail-links">
        ${experiment.links.map((link) => externalLink(link.href, link.label === 'Live' ? 'Launch' : link.label, 'app-link')).join('')}
        ${!experiment.links.length ? '<span class="muted">No public link recorded.</span>' : ''}
      </div>
    </div>`;
}


