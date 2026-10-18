export interface Project {
  title: string;
  /** One line shown under the title and in compact lists. Leave empty to hide. */
  description: string;
  status: string;
  year?: string;
  /** Longer breakdown for the projects page, one string per paragraph. */
  summary?: string[];
  /** Competitions, prizes, venues: "Winner, X Hackathon 2026". */
  recognition?: string[];
  /** Main photo or figure on the projects page. */
  image?: string;
  imageAlt?: string;
  imageCaption?: string;
  /** Which part of the photo to keep when it's cropped to 16:9, as CSS object-position ("center 60%"). */
  imageFocus?: string;
  /** Short muted clip that loops in place of the image (which becomes its poster frame). */
  video?: string;
  /** Always show on the home page, even if it isn't one of the newest three. */
  starred?: boolean;
  tags: string[];
  github?: string;
  pypi?: string;
  paper?: string;
  demo?: string;
  /** Write-up on this site, if there is one. */
  blog?: string;
  link?: string;
  /** Only set in the local preview, for projects marked `publish: preview`. */
  preview?: boolean;
}

import generated from './projects.json';

/**
 * Every project, in the order shown on the site. Generated from the Obsidian notes in
 * PUBLIC_WEBSITE/PROJECTS_WEBSITE by scripts/sync-obsidian.mjs: edit them there, not here.
 * /projects shows all of them; the home page shows the first three plus any marked `starred`.
 * Text fields other than `title` and `imageAlt` are HTML (converted from markdown).
 */
export const projects: Project[] = generated as Project[];
