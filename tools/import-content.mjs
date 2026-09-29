#!/usr/bin/env node
/**
 * Import portfolio content from the local Astro checkout into typed local data.
 *
 * The deployed Retro Desk site never reads the Astro checkout. This script is a
 * repeatable development-time snapshot: it normalizes the Astro content
 * collections, profile, writing, and career history into `src/data/generated/`
 * and records a source path plus verification date for every record.
 *
 * Usage:
 *   node tools/import-content.mjs
 *   ASTRO_SOURCE=/path/to/astro-portfolio node tools/import-content.mjs
 *
 * Re-run this whenever the reference repo changes, then review the diff.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const ASTRO_SOURCE = process.env.ASTRO_SOURCE || '/Users/rabbi/Desktop/Projects/Sites/astro-portfolio';
const WEB = path.join(ASTRO_SOURCE, 'apps', 'web');
const OUT = path.join(ROOT, 'src', 'data', 'generated');
const ARTICLES_OUT = path.join(OUT, 'articles');

const require = createRequire(import.meta.url);
function loadMatter() {
  const candidates = [
    process.env.GRAY_MATTER,
    path.join(WEB, 'node_modules', 'gray-matter'),
    'gray-matter',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch { /* try next */ }
  }
  throw new Error('gray-matter is required to parse the Astro frontmatter.');
}
const matter = loadMatter();

const verifiedAt = new Date().toISOString().slice(0, 10);
const relSource = (absolute) => `astro-portfolio/${path.relative(ASTRO_SOURCE, absolute).split(path.sep).join('/')}`;

const readText = (file) => fs.readFileSync(file, 'utf8');
const readCollection = (dir) =>
  fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md') && !name.endsWith('-bn.md'))
    .map((name) => {
      const absolute = path.join(dir, name);
      const parsed = matter(readText(absolute));
      return { file: absolute, name, data: parsed.data, body: parsed.content.trim() };
    });

function markdownToPlain(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerptFrom(markdown, limit = 180) {
  const firstParagraph = markdown
    .split(/\n{2,}/)
    .map((block) => block.replace(/```[\s\S]*?```/g, '').trim())
    .find((block) => block && !block.startsWith('#'));
  const text = markdownToPlain(firstParagraph || markdown);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`;
}

function readProfile() {
  const source = path.join(WEB, 'src', 'data', 'profile.ts');
  const source_text = readText(source);
  const objectLiteral = source_text
    .replace(/^[\s\S]*?=\s*/, '')
    .replace(/as const;[\s\S]*$/, '');
  // The profile file is a trusted local literal with no imports or side effects.
  const profile = Function(`"use strict"; return (${objectLiteral});`)();
  return { profile, source };
}

const DISK_STYLES = [
  { label: '#d8c6a4', strip: '#5b86a8', ink: '#2a3844' },
  { label: '#c9d8cd', strip: '#4f7d63', ink: '#26382f' },
  { label: '#e2c8bd', strip: '#a05b4c', ink: '#422722' },
  { label: '#cfc6dc', strip: '#6f5a86', ink: '#2f2740' },
];

const EXPERIMENT_KINDS = [
  { match: /game/i, kind: 'game' },
  { match: /3d|webgl/i, kind: 'webgl' },
  { match: /creative|shader|math/i, kind: 'creative' },
];

function projectKind(type) {
  const found = EXPERIMENT_KINDS.find((entry) => entry.match.test(type || ''));
  return found ? found.kind : 'web';
}

function normalizeProject(entry) {
  const d = entry.data;
  const links = [];
  if (d.live) links.push({ label: 'Live', href: d.live });
  if (d.github) links.push({ label: 'GitHub', href: d.github });
  const category = d.category === 'experimental' ? 'experimental' : 'project';
  return {
    id: path.basename(entry.name, '.md'),
    title: d.title,
    type: d.type || (category === 'experimental' ? 'Experiment' : 'Project'),
    category,
    visible: !d.hidden,
    featured: Boolean(d.featured),
    position: typeof d.position === 'number' ? d.position : Number.MAX_SAFE_INTEGER,
    summary: d.description || excerptFrom(d.problem || entry.body || ''),
    problem: d.problem || null,
    solution: d.solution || null,
    impact: d.impact || null,
    role: d.role || null,
    period: d.period || null,
    status: d.status || null,
    stack: (d.tech || []).filter(Boolean),
    highlights: (d.highlights || []).filter(Boolean),
    scope: (d.scope || []).filter(Boolean),
    thumbnail: d.thumbnail || null,
    commits: typeof d.commits === 'number' ? d.commits : null,
    links,
    kind: category === 'experimental' ? projectKind(d.type) : 'project',
    lang: d.lang || 'en',
    sourcePath: relSource(entry.file),
    verifiedAt,
  };
}

function normalizeCareer(entry) {
  const d = entry.data;
  return {
    id: path.basename(entry.name, '.md'),
    title: d.title,
    role: d.role,
    from: d.from,
    to: d.to,
    skills: (d.skills || '').split(',').map((s) => s.trim()).filter(Boolean),
    link: d.link && d.link !== '#' ? d.link : null,
    timeline: d.timeline || null,
    body: entry.body,
    lang: d.lang || 'en',
    sourcePath: relSource(entry.file),
    verifiedAt,
  };
}

function main() {
  if (!fs.existsSync(WEB)) {
    throw new Error(`Astro checkout not found at ${ASTRO_SOURCE}. Set ASTRO_SOURCE to override.`);
  }

  const { profile, source: profileSource } = readProfile();
  // The portfolio owner supplied this updated destination for Retro Desk.
  // Keep it here so a later content import does not restore the older Astro URL.
  profile.links.x = 'https://x.com/itsfazley';
  const xSocial = profile.socials.find((social) => social.id === 'x');
  if (xSocial) xSocial.href = profile.links.x;
  const about = matter(readText(path.join(WEB, 'src', 'content', 'about.md')));
  const journey = matter(readText(path.join(WEB, 'src', 'content', 'journey.md')));

  const projectEntries = readCollection(path.join(WEB, 'src', 'content', 'projects'))
    .map(normalizeProject)
    .sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));

  const career = readCollection(path.join(WEB, 'src', 'content', 'experiences'))
    .map(normalizeCareer)
    .sort((a, b) => (a.timeline || a.from).localeCompare(b.timeline || b.from));

  const posts = JSON.parse(readText(path.join(WEB, 'src', 'data', 'posts.json')));
  const articles = posts
    .filter((post) => post && post.slug && post.title)
    .map((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      lang: post.lang === 'bn' ? 'bn' : 'en',
      publishedAt: post.published_at,
      updatedAt: post.updated_at || null,
      excerpt: post.description || excerptFrom(post.content || ''),
      tags: Array.isArray(post.tags) ? post.tags : [],
      featured: Boolean(post.featured),
      sourcePath: 'astro-portfolio/apps/web/src/data/posts.json',
      verifiedAt,
    }))
    .sort((a, b) => new Date(b.publishedAt).valueOf() - new Date(a.publishedAt).valueOf());

  const visibleProjects = projectEntries.filter((p) => p.visible && p.category !== 'experimental');
  const experiments = projectEntries.filter((p) => p.visible && p.category === 'experimental');
  const featuredDisks = visibleProjects.slice(0, 4).map((project, index) => ({
    ...project,
    diskLabel: project.title.toUpperCase().slice(0, 18),
    diskStyle: DISK_STYLES[index % DISK_STYLES.length],
    diskIndex: index + 1,
  }));

  const profileRecord = {
    ...profile,
    sourcePath: relSource(profileSource),
    verifiedAt,
  };

  const sources = [
    { path: relSource(profileSource), kind: 'profile' },
    { path: `astro-portfolio/apps/web/src/content/about.md`, kind: 'about' },
    { path: `astro-portfolio/apps/web/src/content/journey.md`, kind: 'journey' },
    ...projectEntries.map((p) => ({ path: p.sourcePath, kind: p.category })),
    ...career.map((c) => ({ path: c.sourcePath, kind: 'career' })),
    { path: 'astro-portfolio/apps/web/src/data/posts.json', kind: 'writing' },
  ];

  fs.mkdirSync(ARTICLES_OUT, { recursive: true });
  for (const post of posts) {
    if (!post || !post.slug) continue;
    fs.writeFileSync(
      path.join(ARTICLES_OUT, `${post.slug}.json`),
      `${JSON.stringify({ slug: post.slug, title: post.title, lang: post.lang === 'bn' ? 'bn' : 'en', publishedAt: post.published_at, body: post.content || '' }, null, 0)}\n`,
    );
  }

  const aboutRecord = {
    markdown: about.content.trim(),
    plain: markdownToPlain(about.content),
    sourcePath: 'astro-portfolio/apps/web/src/content/about.md',
    verifiedAt,
  };
  const journeyRecord = {
    markdown: journey.content.trim(),
    plain: markdownToPlain(journey.content),
    sourcePath: 'astro-portfolio/apps/web/src/content/journey.md',
    verifiedAt,
  };

  const banner = `// Generated by tools/import-content.mjs on ${verifiedAt}. Do not edit by hand.\n// Source: ${ASTRO_SOURCE}\n// Re-run: node tools/import-content.mjs\n`;
  const content = `${banner}
import type { Article, CareerEntry, Profile, Project, StaticDocument } from '../types';

export const source = ${JSON.stringify({ path: relSource(path.join(WEB, 'src')), verifiedAt })};
export const profile: Profile & { sourcePath: string; verifiedAt: string } = ${JSON.stringify(profileRecord, null, 2)};
export const about: StaticDocument = ${JSON.stringify(aboutRecord, null, 2)};
export const journey: StaticDocument = ${JSON.stringify(journeyRecord, null, 2)};
export const projects: Project[] = ${JSON.stringify(visibleProjects, null, 2)};
export const experiments: Project[] = ${JSON.stringify(experiments, null, 2)};
export const featuredDisks: Project[] = ${JSON.stringify(featuredDisks, null, 2)};
export const allProjects: Project[] = ${JSON.stringify(projectEntries, null, 2)};
export const career: CareerEntry[] = ${JSON.stringify(career, null, 2)};
export const articles: Article[] = ${JSON.stringify(articles, null, 2)};

const articleBodies = import.meta.glob('./articles/*.json') as Record<string, () => Promise<{ default: { body: string } }>>;

export async function loadArticleBody(slug: string): Promise<string | null> {
  const loader = articleBodies[\`./articles/\${slug}.json\`];
  if (!loader) return null;
  const module = await loader();
  return module.default.body;
}
`;
  fs.writeFileSync(path.join(OUT, 'content.ts'), content);
  fs.writeFileSync(path.join(OUT, 'sources.json'), `${JSON.stringify(sources, null, 2)}\n`);

  const counts = {
    verifiedAt,
    featuredDisks: featuredDisks.map((p) => p.title),
    projects: visibleProjects.length,
    experiments: experiments.length,
    articles: articles.length,
    career: career.length,
  };
  console.log('Imported portfolio content:', JSON.stringify(counts, null, 2));
}

main();
