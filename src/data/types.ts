export interface ProjectLink {
  label: string;
  href: string;
}

export interface DiskStyle {
  label: string;
  strip: string;
  ink: string;
}

export type ProjectCategory = 'project' | 'experimental';

export interface Project {
  id: string;
  title: string;
  type: string;
  category: ProjectCategory;
  visible: boolean;
  featured: boolean;
  position: number;
  summary: string;
  problem: string | null;
  solution: string | null;
  impact: string | null;
  role: string | null;
  period: string | null;
  status: string | null;
  stack: string[];
  highlights: string[];
  scope: string[];
  thumbnail: string | null;
  commits: number | null;
  links: ProjectLink[];
  kind: string;
  lang: 'en' | 'bn';
  sourcePath: string;
  verifiedAt: string;
  diskLabel?: string;
  diskStyle?: DiskStyle;
  diskIndex?: number;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  lang: 'en' | 'bn';
  publishedAt: string;
  updatedAt: string | null;
  excerpt: string;
  tags: string[];
  featured: boolean;
  sourcePath: string;
  verifiedAt: string;
}

export interface CareerEntry {
  id: string;
  title: string;
  role: string;
  from: string;
  to: string;
  skills: string[];
  link: string | null;
  timeline: string | null;
  body: string;
  lang: 'en' | 'bn';
  sourcePath: string;
  verifiedAt: string;
}

export interface SocialLink {
  id: string;
  label: string;
  href: string;
}

export interface Profile {
  name: string;
  shortName: string;
  nameBn: string;
  role: string;
  roleAlternates: string[];
  positioning: string;
  secondary: string;
  description: string;
  location: { city: string; country: string; timezone: string; remote: boolean };
  availability: { headline: string; detail: string };
  experience: { claim: string; start: number };
  focus: string[];
  email: string;
  url: string;
  links: Record<string, string>;
  resume: { pdf: string; cv: string };
  education: { institution: string; credential: string; year: string }[];
  languages: { name: string; level: string }[];
  socials: SocialLink[];
}

export interface StaticDocument {
  markdown: string;
  plain: string;
  sourcePath: string;
  verifiedAt: string;
}
