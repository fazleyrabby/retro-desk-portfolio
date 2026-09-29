export * from './types';
export {
  source,
  profile,
  about,
  journey,
  projects,
  experiments,
  featuredDisks,
  allProjects,
  career,
  articles,
  loadArticleBody,
} from './generated/content';

import { articles, experiments, featuredDisks, projects } from './generated/content';
import type { Article, Project } from './types';

export const projectById = (id: string): Project | undefined =>
  featuredDisks.find((p) => p.id === id) ?? projects.find((p) => p.id === id) ?? experiments.find((p) => p.id === id);

export const featuredDiskById = (id: string): Project | undefined =>
  featuredDisks.find((p) => p.id === id);

export const articleBySlug = (slug: string): Article | undefined =>
  articles.find((a) => a.slug === slug);

export const counts = {
  projects: projects.length,
  experiments: experiments.length,
  articles: articles.length,
  featuredDisks: featuredDisks.length,
} as const;
