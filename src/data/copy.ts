import yaml from 'js-yaml';
// Inlined at build time by Vite, so this works in dev, in the bundled
// build output, and on Netlify without any filesystem access.
import raw from './site-copy.md?raw';

interface PageCopy {
  tabTitle?: string;
  heading?: string;
  subtitle?: string;
}

interface SiteCopy {
  siteName: string;
  metaDescription: string;
  home: PageCopy & { intro: string; featuredHeading: string; recentHeading: string };
  projects: PageCopy;
  essays: PageCopy;
  notes: PageCopy;
  notFound: PageCopy & { eyebrow: string; backLink: string };
}

const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
if (!match) {
  throw new Error('site-copy.md is missing its YAML frontmatter block (--- ... ---)');
}

export const copy = yaml.load(match[1]) as SiteCopy;

/**
 * Browser-tab title for a page: "Essays — Zach Macaskill-Smith".
 * Falls back to the page heading when tabTitle is omitted, and never
 * appends the site name twice (so home stays just "Zach Macaskill-Smith").
 */
export function pageTitle(page: PageCopy): string {
  const label = page.tabTitle ?? page.heading ?? '';
  return label === copy.siteName ? label : `${label} — ${copy.siteName}`;
}
