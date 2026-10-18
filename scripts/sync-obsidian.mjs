#!/usr/bin/env node
// Mirror the PUBLIC_WEBSITE folder of the Obsidian vault into the site.
//
//   node scripts/sync-obsidian.mjs preview-start   start (or refresh) the local preview at localhost:4322
//   node scripts/sync-obsidian.mjs preview-stop    stop it
//   node scripts/sync-obsidian.mjs publish         sync a separate clone, build, commit and push if anything changed
//   node scripts/sync-obsidian.mjs publish-now     same, but asks you to confirm in a dialog first (the "Publish now" link)
//   node scripts/sync-obsidian.mjs scheduled       same as publish, but only if the last sync was 3+ days ago
//   add --force to allow a run that would remove more than half of what's live
//
// Obsidian is the source of truth: src/content/{essays,notes} and public/images/{essays,notes}
// (plus the generated project and site-text files) are overwritten to match it. Only pages with
// `publish: live` are published; `publish: preview` pages show only in the local preview.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

// ─── Configuration ──────────────────────────────────────────────────────────

const HOME = os.homedir();
// Links and the schedule run with a minimal PATH; make sure npm (next to this node) is found.
process.env.PATH = [path.dirname(process.execPath), process.env.PATH ?? '/usr/bin:/bin'].join(':');
const VAULT = process.env.OBSIDIAN_VAULT ?? path.join(HOME, 'Documents/obsidian/ObsidianPersonal');
const PUBLIC_DIR = path.join(VAULT, 'PUBLIC_WEBSITE');
const SITE_URL = 'https://zachmacsmith.com';
const REMOTE = 'https://github.com/zachmacsmith/zachmacsmith.com.git';
const INTERVAL_DAYS = 3;

const SECTIONS = [
  { key: 'essays', label: 'Writing', folder: 'WRITING_WEBSITE', urlBase: '/writing/essays/' },
  { key: 'notes', label: 'Notes', folder: 'NOTES_WEBSITE', urlBase: '/writing/notes/' },
];

const PROJECTS = { key: 'projects', label: 'Projects', folder: 'PROJECTS_WEBSITE', urlBase: '/projects#' };
const SITE_TEXT = { key: 'site', label: 'Site text', folder: 'SITE_TEXT' };
const DISPLAY_SECTIONS = [...SECTIONS, PROJECTS, SITE_TEXT];

/** SITE_TEXT notes: which ones must exist, the page they set, and the properties they need. */
const SITE_PAGES = [
  { name: 'Site', url: '/', required: ['name'] },
  { name: 'Home', url: '/', required: [] },
  { name: 'Projects', url: '/projects', required: ['heading'] },
  { name: 'Writing', url: '/writing/essays', required: ['heading'] },
  { name: 'Notes', url: '/writing/notes', required: ['heading'] },
  { name: 'Page not found', url: '/404', required: ['heading'] },
];

const STATUS_FILE = '_Site status.md';
const LOG_FILE = '_Site changelog.md';
const STATE_FILE = '.sync-state.json'; // hidden in Obsidian
const OWN_FILES = /(^|\/)(_Site [^/]*\.md|\.sync-state\.json)$/; // written by this script; changes to them don't count as edits

const WORK_DIR = path.join(HOME, '.website-sync');
const CLONE_DIR = path.join(WORK_DIR, 'zachmacsmith.com');
const RUN_LOG = path.join(WORK_DIR, 'sync.log');
const THIS_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PREVIEW_DIR = path.join(WORK_DIR, 'preview');
const PREVIEW_STATE = path.join(WORK_DIR, 'preview.json');
const PREVIEW_PORT = 4322; // what you open
const ASTRO_PORT = 4323; // the dev server behind it
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;
const PREVIEW_NOTE = '_Site preview.md';
const IDLE_MINUTES = 60;
const SCHEDULE_PLIST = path.join(HOME, 'Library/LaunchAgents/com.zachmacsmith.website-sync.plist');

/** What each zsite:// link in the vault notes runs. */
const LINKS = { 'preview/start': 'preview-start', 'preview/stop': 'preview-stop', publish: 'publish-now', 'sync/scheduled': 'scheduled' };

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov']);

// ─── Small helpers ──────────────────────────────────────────────────────────

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitBuf = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });

function log(msg) {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  fs.appendFileSync(RUN_LOG, `${new Date().toISOString()}  ${msg}\n`);
  console.log(msg);
}

function notify(message) {
  try {
    execFileSync('osascript', ['-e', `display notification ${JSON.stringify(message)} with title "Website sync"`]);
  } catch { /* not on macOS, or notifications blocked */ }
}

function slugify(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

/** The local calendar day a moment fell on (file creation times), as UTC midnight. */
function localDay(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00Z`);
}

function formatDay(d) {
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatStamp(d) {
  return `${formatDay(d)}, ${d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Parse a frontmatter date (Date object or string). Returns a Date at UTC midnight, or null. */
function parseDay(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return undefined; // present but invalid
  return new Date(`${isoDay(d)}T00:00:00Z`);
}

function toList(value) {
  if (value == null) return [];
  const raw = Array.isArray(value) ? value : String(value).split(/[,\s]+/);
  return raw.map((t) => String(t).trim().replace(/^#/, '')).filter(Boolean);
}

/**
 * The `publish` property: `live` goes on the website, `preview` only shows in the local preview,
 * anything else (`off`, empty, missing) is ignored. `true` and `false` still work too.
 */
function publishState(data) {
  const value = typeof data.publish === 'string' ? data.publish.trim().toLowerCase() : data.publish;
  if (value === true || value === 'live') return 'live';
  if (value === 'preview') return 'preview';
  return 'off';
}

const OFF_REASON = (data) => (data.publish == null || data.publish === '' ? 'no `publish` property' : `\`publish: ${data.publish}\``);

function splitFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { data: {}, body: text };
  return { data: yaml.load(m[1]) ?? {}, body: text.slice(m[0].length) };
}

function walk(dir, filter) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filter));
    else if (filter(entry.name)) out.push(full);
  }
  return out;
}

// ─── Read the vault ─────────────────────────────────────────────────────────

/** Every file in the vault by lowercase basename, the way Obsidian resolves ![[name]]. */
function indexVault() {
  const index = new Map();
  for (const file of walk(VAULT, () => true)) {
    const key = path.basename(file).toLowerCase();
    if (!index.has(key)) index.set(key, file);
  }
  return index;
}

function readSources(state, problems) {
  const pages = [];
  const skipped = [];
  for (const section of SECTIONS) {
    const dir = path.join(PUBLIC_DIR, section.folder);
    for (const file of walk(dir, (n) => n.endsWith('.md') && !n.startsWith('_'))) {
      const rel = path.relative(PUBLIC_DIR, file);
      const name = path.basename(file, '.md');
      let parsed;
      try {
        parsed = splitFrontmatter(fs.readFileSync(file, 'utf8'));
      } catch (err) {
        problems.push(`${rel}: couldn't read the properties block (${err.message.split('\n')[0]}). Skipped.`);
        skipped.push({ rel, why: 'properties block has an error' });
        continue;
      }
      const { data, body } = parsed;

      // Creation date: the earliest of the file's own creation time and the first time a sync saw it.
      const born = fs.statSync(file).birthtime;
      const seen = state.firstSeen[rel] ? new Date(state.firstSeen[rel]) : null;
      const created = seen && seen < born ? seen : born;
      state.firstSeen[rel] = created.toISOString();

      const publish = publishState(data);
      if (publish === 'off') {
        skipped.push({ rel, why: OFF_REASON(data) });
        continue;
      }

      const date = parseDay(data.date);
      const updated = parseDay(data.updated);
      if (date === undefined || updated === undefined) {
        problems.push(`${rel}: \`${date === undefined ? 'date' : 'updated'}\` isn't a date (use 2026-10-17). Skipped.`);
        skipped.push({ rel, why: 'invalid date' });
        continue;
      }

      pages.push({
        section,
        rel,
        file,
        title: data.title != null ? String(data.title) : name,
        slug: data.slug != null ? slugify(String(data.slug)) : slugify(name),
        date: date ?? localDay(created),
        updated,
        description: data.description != null ? String(data.description) : undefined,
        tags: toList(data.tags),
        status: data.status != null ? String(data.status) : undefined,
        body,
        name,
        preview: publish === 'preview',
      });
    }
  }

  // Two pages in one section can't share a URL.
  for (const section of SECTIONS) {
    const seen = new Map();
    for (const p of pages.filter((p) => p.section === section)) {
      if (seen.has(p.slug)) {
        throw new Error(`"${seen.get(p.slug)}" and "${p.rel}" would both publish at ${section.urlBase}${p.slug}. Give one a different \`slug\`.`);
      }
      seen.set(p.slug, p.rel);
    }
  }
  return { pages, skipped };
}

// ─── Convert Obsidian markdown ──────────────────────────────────────────────

function convert(page, ctx) {
  const { vaultIndex, pageByName, problems } = ctx;
  const images = new Map(); // output name -> source file
  const imgDir = `/images/${page.section.key}/`;

  function addImage(source) {
    const ext = path.extname(source).toLowerCase();
    let out = slugify(path.basename(source, path.extname(source))) + ext;
    const existing = ctx.imageOwners.get(page.section.key + '/' + out);
    if (existing && existing !== source) out = `${path.basename(out, ext)}-${sha(source).slice(0, 6)}${ext}`;
    ctx.imageOwners.set(page.section.key + '/' + out, source);
    images.set(out, source);
    return imgDir + out;
  }

  function imageTag(url, alt, width) {
    const safeAlt = (alt ?? '').replace(/"/g, '&quot;');
    if (width) return `<img src="${url}" alt="${safeAlt}" style="max-width: ${width}px; width: 100%; height: auto;" />`;
    return `![${alt ?? ''}](${url})`;
  }

  function resolveFile(target) {
    const clean = target.split('#')[0].trim();
    if (!clean) return null;
    return vaultIndex.get(path.basename(clean).toLowerCase())
      ?? vaultIndex.get((path.basename(clean) + '.md').toLowerCase())
      ?? null;
  }

  function transform(text) {
    // ![[file|alt|width]] embeds
    text = text.replace(/!\[\[([^\]|]+)((?:\|[^\]|]*)*)\]\]/g, (_, target, rest) => {
      const parts = rest.split('|').slice(1);
      let width;
      if (parts.length && /^\d+(x\d+)?$/.test(parts.at(-1).trim())) width = parts.pop().trim().split('x')[0];
      const alt = parts.join('|').trim() || undefined;
      const source = resolveFile(target);
      if (!source) {
        problems.push(`${page.rel}: embedded file "${target}" not found in the vault. Left out.`);
        return '';
      }
      if (!IMAGE_EXT.has(path.extname(source).toLowerCase())) {
        problems.push(`${page.rel}: "![[${target}]]" embeds a note or file, which the site can't show. Left out.`);
        return '';
      }
      return imageTag(addImage(source), alt, width);
    });

    // ![alt](relative/path.png) markdown images
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (match, altRaw, target) => {
      if (/^(https?:)?\/\//.test(target) || target.startsWith('/') || target.startsWith('data:')) return match;
      let alt = altRaw;
      let width;
      const m = altRaw.match(/^(.*)\|(\d+)(?:x\d+)?$/);
      if (m) { alt = m[1]; width = m[2]; }
      const decoded = decodeURIComponent(target);
      const local = path.resolve(path.dirname(page.file), decoded);
      const source = fs.existsSync(local) ? local : resolveFile(decoded);
      if (!source) {
        problems.push(`${page.rel}: image "${decoded}" not found in the vault. Left out.`);
        return '';
      }
      return imageTag(addImage(source), alt, width);
    });

    // [[Page|text]] links: link to the page if it's published, otherwise plain text
    text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => {
      const [name, heading] = target.split('#');
      const text = label ?? (name.trim() || heading);
      const linked = pageByName.get(path.basename(name.trim()).toLowerCase());
      if (!linked) return text;
      const anchor = heading ? `#${slugify(heading)}` : '';
      return `[${text}](${linked.section.urlBase}${linked.slug}${anchor})`;
    });

    // ==highlight==
    text = text.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
    return text;
  }

  let body = page.body.replace(/%%[\s\S]*?%%/g, '').replace(/\n{3,}/g, '\n\n'); // Obsidian comments

  // Callouts: "> [!note] Title" becomes a blockquote with a bold title.
  body = body.replace(/^(>\s*)\[!(\w+)\][+-]?[ \t]*(.*)$/gm, (_, q, type, title) =>
    `${q}**${title.trim() || type[0].toUpperCase() + type.slice(1)}**\n>`);

  // Leave code untouched: transform only the text between fenced blocks and inline code.
  const out = body
    .split(/(^```[\s\S]*?^```[ \t]*$|^~~~[\s\S]*?^~~~[ \t]*$)/m)
    .map((chunk, i) => (i % 2 ? chunk : chunk.split(/(`[^`\n]+`)/).map((c, j) => (j % 2 ? c : transform(c))).join('')))
    .join('');

  return { body: out, images };
}

function renderPage(page, body, preview = false) {
  const fm = [
    `title: ${JSON.stringify(page.title)}`,
    `date: ${isoDay(page.date)}`,
    ...(page.updated ? [`updated: ${isoDay(page.updated)}`] : []),
    ...(page.description ? [`description: ${JSON.stringify(page.description)}`] : []),
    `tags: ${JSON.stringify(page.tags)}`,
    ...(page.status ? [`status: ${JSON.stringify(page.status)}`] : []),
    ...(preview ? ['preview: true'] : []),
  ];
  return `---\n${fm.join('\n')}\n---\n\n<!-- Generated from Obsidian (${page.rel}). Edit it there, not here. -->\n\n${body.replace(/^\s*\n/, '')}`;
}

// ─── Projects and site text ─────────────────────────────────────────────────

const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline markdown (links, bold, italics, code) to HTML, for short text like subtitles and project summaries. */
function inlineHtml(md) {
  const codes = [];
  let t = escapeHtml(md.trim()).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}"${ext}>${text}</a>`;
  });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/&lt;mark&gt;(.*?)&lt;\/mark&gt;/g, '<mark>$1</mark>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[i])}</code>`);
}

const paragraphs = (md) => md.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

/** A property that points at a file (`[[photo.jpg]]` or `photo.jpg`): copy it into the site and return its URL. */
function mediaProperty(value, rel, ctx, files) {
  if (value == null || value === '') return undefined;
  const target = String(value).replace(/^!?\[\[|\]\]$/g, '').split('|')[0].trim();
  if (/^(https?:)?\/\//.test(target) || target.startsWith('/')) return target;
  const source = ctx.vaultIndex.get(path.basename(target).toLowerCase());
  if (!source) {
    ctx.problems.push(`${rel}: file "${target}" not found in the vault. Left out.`);
    return undefined;
  }
  const ext = path.extname(source).toLowerCase();
  const dir = VIDEO_EXT.has(ext) ? 'public/videos' : 'public/images/projects';
  const out = `${dir}/${slugify(path.basename(source, ext))}${ext}`;
  files.set(out, fs.readFileSync(source));
  return '/' + out.replace(/^public\//, '');
}

/** A property that links somewhere: a URL, a site path, or `[[Note]]` for a published essay or note. */
function linkProperty(value, rel, ctx) {
  if (value == null || value === '') return undefined;
  const raw = String(value).trim();
  const wiki = raw.match(/^\[\[([^\]|#]+)/);
  if (!wiki) return raw;
  const linked = ctx.pageByName.get(path.basename(wiki[1].trim()).toLowerCase());
  if (!linked) {
    ctx.problems.push(`${rel}: link "${raw}" points at a page that isn't published. Left out.`);
    return undefined;
  }
  return `${linked.section.urlBase}${linked.slug}`;
}

function readProjects(state, ctx, files, skipped, target) {
  const dir = path.join(PUBLIC_DIR, PROJECTS.folder);
  const projects = [];
  for (const file of walk(dir, (n) => n.endsWith('.md') && !n.startsWith('_'))) {
    const rel = path.relative(PUBLIC_DIR, file);
    const name = path.basename(file, '.md');
    let parsed;
    try { parsed = splitFrontmatter(fs.readFileSync(file, 'utf8')); } catch (err) {
      ctx.problems.push(`${rel}: couldn't read the properties block (${err.message.split('\n')[0]}). Skipped.`);
      skipped.push({ rel, why: 'properties block has an error' });
      continue;
    }
    const { data, body } = parsed;
    const publish = publishState(data);
    if (publish === 'off') {
      skipped.push({ rel, why: OFF_REASON(data) });
      continue;
    }
    const { body: converted } = convert({ rel, file, body, section: PROJECTS }, ctx);
    const title = data.title != null ? String(data.title) : name;
    // A held-back project keeps its live version, so its new photo shouldn't be published either.
    const media = publish === 'preview' && target === 'live' ? new Map() : files;
    const project = {
      title,
      slug: slugify(data.slug != null ? String(data.slug) : name),
      description: data.description != null ? inlineHtml(String(data.description)) : '',
      status: data.status != null ? String(data.status) : '',
      year: data.year != null ? String(data.year) : undefined,
      summary: paragraphs(converted).map(inlineHtml),
      recognition: (Array.isArray(data.recognition) ? data.recognition : data.recognition ? [data.recognition] : []).map((r) => inlineHtml(String(r))),
      image: mediaProperty(data.image, rel, ctx, media),
      video: mediaProperty(data.video, rel, ctx, media),
      imageAlt: data.image_alt != null ? String(data.image_alt) : undefined,
      imageCaption: data.caption != null ? inlineHtml(String(data.caption)) : undefined,
      imageFocus: data.image_focus != null ? String(data.image_focus) : undefined,
      starred: data.starred === true,
      tags: toList(Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : []),
      github: linkProperty(data.github, rel, ctx),
      pypi: linkProperty(data.pypi, rel, ctx),
      paper: linkProperty(data.paper, rel, ctx),
      demo: linkProperty(data.demo, rel, ctx),
      blog: linkProperty(data.essay, rel, ctx),
      link: linkProperty(data.link, rel, ctx),
      order: data.order != null && !Number.isNaN(Number(data.order)) ? Number(data.order) : undefined,
      rel,
      held: publish === 'preview',
      ...(publish === 'preview' && target === 'preview' ? { preview: true } : {}),
    };
    projects.push(project);
  }
  // Explicit `order` first (1 = top), then newest year, then title.
  projects.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity)
    || (b.year ?? '').localeCompare(a.year ?? '') || a.title.localeCompare(b.title));
  return projects;
}

function readSiteText(ctx) {
  const dir = path.join(PUBLIC_DIR, SITE_TEXT.folder);
  const notes = {};
  for (const spec of SITE_PAGES) {
    const file = path.join(dir, `${spec.name}.md`);
    if (!fs.existsSync(file)) throw new Error(`SITE_TEXT is missing "${spec.name}.md". Every page needs its note, so nothing was synced.`);
    const { data, body } = splitFrontmatter(fs.readFileSync(file, 'utf8'));
    for (const key of spec.required) {
      if (data[key] == null || String(data[key]).trim() === '') {
        throw new Error(`SITE_TEXT/${spec.name}.md needs a \`${key}\` property, so nothing was synced.`);
      }
    }
    const rel = path.relative(PUBLIC_DIR, file);
    const { body: converted } = convert({ rel, file, body, section: SITE_TEXT }, ctx);
    notes[spec.name] = { data, body: converted.trim(), rel, held: publishState(data) === 'preview' };
  }
  const str = (v, fallback) => (v != null && String(v).trim() !== '' ? String(v) : fallback);
  const subtitle = (n) => {
    const paras = paragraphs(notes[n].body);
    if (paras.length > 1) ctx.problems.push(`SITE_TEXT/${n}.md: only the first paragraph is used as the subtitle.`);
    return inlineHtml(paras[0] ?? '');
  };
  const site = notes.Site.data;
  const copy = {
    siteName: String(site.name),
    metaDescription: str(site.description, `Personal website of ${site.name}.`),
    home: {
      tabTitle: str(notes.Home.data.tab_title, String(site.name)),
      projectsHeading: str(notes.Home.data.projects_heading, 'Projects'),
      writingHeading: str(notes.Home.data.writing_heading, 'Writing'),
    },
    projects: { heading: String(notes.Projects.data.heading), tabTitle: str(notes.Projects.data.tab_title, String(notes.Projects.data.heading)), subtitle: subtitle('Projects') },
    essays: { heading: String(notes.Writing.data.heading), tabTitle: str(notes.Writing.data.tab_title, String(notes.Writing.data.heading)), subtitle: subtitle('Writing') },
    notes: { heading: String(notes.Notes.data.heading), tabTitle: str(notes.Notes.data.tab_title, String(notes.Notes.data.heading)), subtitle: subtitle('Notes') },
    notFound: {
      tabTitle: '404',
      eyebrow: '404',
      heading: String(notes['Page not found'].data.heading),
      subtitle: subtitle('Page not found'),
      backLink: str(notes['Page not found'].data.back_link, '← Back to home'),
    },
  };
  return { copy, homeIntro: notes.Home.body, notes };
}

// ─── Build the full set of output files ─────────────────────────────────────

/**
 * Build every output file from the vault.
 *   target 'live':    what the website should show. `publish: preview` pages keep their live version
 *                     (taken from liveFiles), or stay off the site if they aren't live yet.
 *   target 'preview': everything, with `publish: preview` pages marked so the site shows a banner.
 */
function generate(state, { target = 'live', liveFiles = new Map(), live = new Map() } = {}) {
  if (!fs.existsSync(PUBLIC_DIR)) {
    throw new Error(`Can't find the PUBLIC_WEBSITE folder at ${PUBLIC_DIR}. If you moved the vault, update VAULT in scripts/sync-obsidian.mjs.`);
  }
  for (const s of [...SECTIONS, PROJECTS, SITE_TEXT]) {
    if (!fs.existsSync(path.join(PUBLIC_DIR, s.folder))) {
      throw new Error(`Can't find ${s.folder} inside PUBLIC_WEBSITE. If you renamed it, update the folder names in scripts/sync-obsidian.mjs.`);
    }
  }

  const problems = [];
  const { pages: sourcePages, skipped } = readSources(state, problems);
  const liveOutput = (p) => `src/content/${p.section.key}/${p.slug}.md`;
  const isLive = (p) => liveFiles.has(liveOutput(p));

  // Pages that will exist on the site being built (so [[links]] to anything else become plain text).
  const pages = sourcePages.filter((p) => target === 'preview' || !p.preview || isLive(p));
  for (const p of sourcePages) {
    if (p.preview && target === 'live') {
      skipped.push({ rel: p.rel, why: isLive(p) ? '`publish: preview`, live version kept' : '`publish: preview`, not live yet' });
    }
  }

  const ctx = {
    vaultIndex: indexVault(),
    pageByName: new Map(pages.map((p) => [p.name.toLowerCase(), p])),
    imageOwners: new Map(),
    problems,
  };

  const files = new Map(); // repo-relative path -> Buffer
  for (const page of pages) {
    page.output = liveOutput(page);
    if (page.preview && target === 'live') {
      // Held back: republish exactly what's live, images included.
      const md = liveFiles.get(page.output);
      files.set(page.output, md);
      for (const [, key, name] of md.toString('utf8').matchAll(/\/images\/(\w+)\/([^)"\s]+)/g)) {
        const rel = `public/images/${key}/${name}`;
        if (liveFiles.has(rel)) files.set(rel, liveFiles.get(rel));
      }
      continue;
    }
    const { body, images } = convert(page, ctx);
    files.set(page.output, Buffer.from(renderPage(page, body, target === 'preview' && page.preview)));
    for (const [name, source] of images) files.set(`public/images/${page.section.key}/${name}`, fs.readFileSync(source));
  }

  // Projects: one JSON file the site reads, plus their photos and videos.
  const liveProjects = liveFiles.has('src/data/projects.json') ? JSON.parse(liveFiles.get('src/data/projects.json').toString('utf8')) : [];
  const projects = [];
  for (const project of readProjects(state, ctx, files, skipped, target)) {
    if (!project.held || target === 'preview') { projects.push(project); continue; }
    const kept = liveProjects.find((p) => p.slug === project.slug);
    skipped.push({ rel: project.rel, why: kept ? '`publish: preview`, live version kept' : '`publish: preview`, not live yet' });
    if (!kept) continue;
    for (const url of [kept.image, kept.video].filter((u) => u?.startsWith('/'))) {
      if (liveFiles.has('public' + url)) files.set('public' + url, liveFiles.get('public' + url));
    }
    projects.push({ ...kept, rel: project.rel, order: project.order, held: true });
  }
  const projectItems = projects.map(({ rel, order, held, ...p }) => p);
  files.set('src/data/projects.json', Buffer.from(JSON.stringify(projectItems, null, 2) + '\n'));

  // Site text: the same site-copy.md and home-intro.md files the site already reads.
  const { copy, homeIntro: newIntro, notes } = readSiteText(ctx);
  let homeIntro = newIntro;
  if (target === 'live') {
    const liveCopyFile = liveFiles.get('src/data/site-copy.md');
    const liveCopy = liveCopyFile ? splitFrontmatter(liveCopyFile.toString('utf8')).data : null;
    const keys = { Site: ['siteName', 'metaDescription'], Home: ['home'], Projects: ['projects'], Writing: ['essays'], Notes: ['notes'], 'Page not found': ['notFound'] };
    for (const spec of SITE_PAGES) {
      if (!notes[spec.name].held) continue;
      if (!liveCopy) throw new Error(`SITE_TEXT/${spec.name}.md has \`publish: preview\`, but there's no live version to keep. Remove it for the first sync.`);
      for (const k of keys[spec.name]) copy[k] = liveCopy[k];
      if (spec.name === 'Home') {
        homeIntro = (liveFiles.get('src/data/home-intro.md')?.toString('utf8') ?? '').replace(/^<!--[\s\S]*?-->\s*/, '').trim();
      }
      skipped.push({ rel: notes[spec.name].rel, why: '`publish: preview`, live version kept' });
    }
  }
  const generatedNote = '# Generated from Obsidian (PUBLIC_WEBSITE/SITE_TEXT). Edit it there, not here.\n';
  files.set('src/data/site-copy.md', Buffer.from(`---\n${generatedNote}${yaml.dump(copy, { lineWidth: -1 })}---\n`));
  files.set('src/data/home-intro.md', Buffer.from(`<!-- Generated from Obsidian (PUBLIC_WEBSITE/SITE_TEXT/Home.md). Edit it there, not here. -->\n\n${homeIntro}\n`));

  // Everything that isn't an essay or note page is tracked through a manifest, so changes can be reported.
  const keptHash = (key, fresh) => (target === 'live' && live.get(key)?.hash) || fresh;
  const items = [
    ...projects.map((p) => {
      const { rel, order, held, ...entry } = p;
      const key = `projects/${p.slug}`;
      const hash = sha(JSON.stringify(entry) + [entry.image, entry.video].filter(Boolean).map((u) => sha(files.get('public' + u) ?? '')).join());
      return { key, section: PROJECTS, title: p.title, url: `/projects#${p.slug}`, preview: Boolean(entry.preview), hash: held ? keptHash(key, hash) : hash };
    }),
    ...SITE_PAGES.map((spec) => {
      const key = `site/${spec.name}`;
      const hash = sha(JSON.stringify(notes[spec.name].data) + notes[spec.name].body);
      const held = notes[spec.name].held;
      return { key, section: SITE_TEXT, title: spec.name, url: spec.url, preview: held && target === 'preview', hash: held ? keptHash(key, hash) : hash };
    }),
  ];
  const manifest = Object.fromEntries(items.map((i) => [i.key, { title: i.title, url: i.url, hash: i.hash }]));
  files.set('src/data/sync-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));

  return { pages, items, skipped, problems, files };
}

const OWNED_DIRS = [
  ...SECTIONS.flatMap((s) => [`src/content/${s.key}`, `public/images/${s.key}`]),
  'public/images/projects',
  'public/videos',
];
const OWNED_FILES = ['src/data/projects.json', 'src/data/site-copy.md', 'src/data/home-intro.md', 'src/data/sync-manifest.json'];
const OWNED = [...OWNED_DIRS, ...OWNED_FILES];

/** What's on the live site (origin/main), as key -> { section, title, url?, hash }. */
function liveSnapshot(repo) {
  try { git(repo, 'fetch', '--quiet', 'origin'); } catch { /* offline: compare with the last fetched state */ }
  const listed = git(repo, 'ls-tree', '-r', '--name-only', 'origin/main', '--', ...OWNED).split('\n').filter(Boolean);
  const blobs = new Map(listed.map((p) => [p, gitBuf(repo, 'show', `origin/main:${p}`)]));
  const live = new Map();
  for (const [p, buf] of blobs) {
    const m = p.match(/^src\/content\/(\w+)\/(.+)\.md$/);
    if (!m) continue;
    const section = SECTIONS.find((s) => s.key === m[1]);
    const text = buf.toString('utf8');
    const title = splitFrontmatter(text).data.title ?? m[2];
    live.set(`${m[1]}/${m[2]}`, { section, slug: m[2], title, hash: pageHash(text, (rel) => blobs.get(rel)) });
  }
  const manifest = blobs.get('src/data/sync-manifest.json');
  if (manifest) {
    for (const [key, entry] of Object.entries(JSON.parse(manifest.toString('utf8')))) {
      const section = key.startsWith('projects/') ? PROJECTS : SITE_TEXT;
      live.set(key, { section, ...entry });
    }
  }
  return { live, blobs };
}

function pageHash(markdown, readImage) {
  const parts = [markdown];
  for (const [, key, name] of markdown.matchAll(/\/images\/(\w+)\/([^)"\s]+)/g)) {
    const buf = readImage(`public/images/${key}/${name}`);
    parts.push(buf ? sha(buf) : 'missing');
  }
  return sha(parts.join('\n'));
}

function compare(pages, items, files, live) {
  const changes = { added: [], updated: [], removed: [], unchanged: [] };
  const all = [
    ...pages.map((page) => ({ entry: page, key: `${page.section.key}/${page.slug}`, hash: pageHash(files.get(page.output).toString('utf8'), (rel) => files.get(rel)) })),
    ...items.map((item) => ({ entry: item, key: item.key, hash: item.hash })),
  ];
  const keys = new Set();
  for (const { entry, key, hash } of all) {
    keys.add(key);
    const before = live.get(key);
    // Before the first sync, the live site has no manifest: report projects and site text as updates, not additions.
    if (!before) (entry.section === SITE_TEXT || (entry.section === PROJECTS && !hasManifest(live)) ? changes.updated : changes.added).push(entry);
    else if (before.hash !== hash) changes.updated.push(entry);
    else changes.unchanged.push(entry);
  }
  for (const [key, entry] of live) if (!keys.has(key)) changes.removed.push(entry);
  return changes;
}

const hasManifest = (live) => [...live.values()].some((e) => e.section === PROJECTS || e.section === SITE_TEXT);

/** Make the owned folders of `repo` match `files` exactly. */
function writeInto(repo, files) {
  for (const dir of OWNED_DIRS) {
    const abs = path.join(repo, dir);
    fs.mkdirSync(abs, { recursive: true });
    for (const existing of walk(abs, () => true)) {
      const rel = path.relative(repo, existing);
      if (!files.has(rel)) fs.rmSync(existing);
    }
    for (const name of fs.readdirSync(abs, { withFileTypes: true })) {
      if (name.name.startsWith('.')) fs.rmSync(path.join(abs, name.name), { recursive: true, force: true });
    }
  }
  for (const [rel, buf] of files) {
    const abs = path.join(repo, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (!fs.existsSync(abs) || !fs.readFileSync(abs).equals(buf)) fs.writeFileSync(abs, buf);
  }
}

// ─── Status and changelog files in the vault ────────────────────────────────

const pagePath = (p) => p.url ?? `${p.section.urlBase}${p.slug}`;
const pageUrl = (p) => `${SITE_URL}${pagePath(p)}`;
const pageLink = (p) => `[${p.title}](${pageUrl(p)})`;

function writeStatus({ mode, outcome, state, pages, skipped, problems, changes }) {
  const now = new Date();
  const last = state.lastSuccess ? new Date(state.lastSuccess) : null;
  const next = last ? new Date(last.getTime() + INTERVAL_DAYS * 86400e3) : null;
  const lines = [
    '# Website sync status',
    '',
    "> Rewritten automatically on every sync. Don't edit it; it's never published.",
    '',
    `**Last run:** ${formatStamp(now)}: ${outcome}`,
    `**Last successful sync:** ${last ? formatStamp(last) : 'never'}`,
    `**Next scheduled sync:** ${next ? `on or after ${formatDay(next)}` : 'next time the schedule runs'} (only when your Mac is on)`,
    '',
  ];

  if (mode === 'preview' && changes) {
    lines.push('## Preview: what the next sync would change', '');
    const any = changes.added.length + changes.updated.length + changes.removed.length;
    if (!any) lines.push('Nothing. The live site already matches these folders.', '');
    for (const p of changes.added) lines.push(`- **Add** (${p.section.label}): ${p.title}`);
    for (const p of changes.updated) lines.push(`- **Update** (${p.section.label}): ${pageLink(p)}`);
    for (const p of changes.removed) lines.push(`- **Remove** (${p.section.label}): ${p.title}`);
    if (any) lines.push('');
  }

  lines.push(mode === 'preview' ? '## Currently live (before this preview)' : '## Currently live', '');
  const liveNow = mode === 'preview' && changes ? [...changes.updated, ...changes.unchanged, ...changes.removed] : pages;
  for (const section of DISPLAY_SECTIONS) {
    const rows = liveNow.filter((p) => p.section.key === section.key);
    lines.push(`### ${section.label} (${rows.length})`, '');
    if (!rows.length) { lines.push('_Nothing live yet._', ''); continue; }
    lines.push('| Title | Link |', '| --- | --- |');
    for (const p of rows.sort((a, b) => (b.date ?? 0) - (a.date ?? 0))) {
      lines.push(`| ${p.title.replace(/\|/g, '\\|')} | [${pagePath(p)}](${pageUrl(p)}) |`);
    }
    lines.push('');
  }

  lines.push('## In the folders but not published', '');
  if (!skipped.length) lines.push('_None._', '');
  else {
    lines.push('| File | Why |', '| --- | --- |');
    for (const s of skipped) lines.push(`| ${s.rel.replace(/\|/g, '\\|')} | ${s.why} |`);
    lines.push('');
  }

  lines.push('## Warnings', '');
  if (!problems.length) lines.push('_None._');
  else for (const p of problems) lines.push(`- ${p}`);
  lines.push('');

  fs.writeFileSync(path.join(PUBLIC_DIR, STATUS_FILE), lines.join('\n'));
}

/** Keep the last good status, but flag the failure at the top. */
function markStatusFailed(message) {
  try {
    const file = path.join(PUBLIC_DIR, STATUS_FILE);
    const banner = `> **The last sync failed (${formatStamp(new Date())}).** Nothing was changed on the website.\n>\n> ${message.replace(/\n/g, '\n> ')}\n`;
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/^> \*\*The last sync failed[\s\S]*?\n(?!>)/m, '') : '# Website sync status\n';
    fs.writeFileSync(file, old.replace(/^(# .*\n)/, `$1\n${banner}`));
  } catch { /* status is best-effort */ }
}

function appendChangelog(changes, commit) {
  const file = path.join(PUBLIC_DIR, LOG_FILE);
  const header = '# Website changelog\n\n> Written automatically each time the sync updates the website. Newest first. Never published.\n\n';
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/^[\s\S]*?(?=^## )/m, '') : '';
  const entry = [`## ${formatStamp(new Date())} (commit ${commit.slice(0, 7)})`, ''];
  for (const p of changes.added) entry.push(`- Added (${p.section.label}): ${pageLink(p)}`);
  for (const p of changes.updated) entry.push(`- Updated (${p.section.label}): ${pageLink(p)}`);
  for (const p of changes.removed) entry.push(`- Removed (${p.section.label}): ${p.title}`);
  if (entry.length === 2) entry.push('- Images or formatting only');
  fs.writeFileSync(file, header + entry.join('\n') + '\n\n' + existing);
}

// ─── Runs ───────────────────────────────────────────────────────────────────

function loadState() {
  try { return { firstSeen: {}, ...JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, STATE_FILE), 'utf8')) }; }
  catch { return { firstSeen: {} }; }
}

function saveState(state) {
  const file = path.join(PUBLIC_DIR, STATE_FILE);
  const text = JSON.stringify(state, null, 2) + '\n';
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
}

function guardRemovals(changes, live, force) {
  const removing = changes.removed.length;
  if (!force && live.size >= 2 && removing > live.size / 2) {
    throw new Error(`This would remove ${removing} of ${live.size} live pages. If that's intended, run it again with --force.`);
  }
}

function summary(changes) {
  const parts = [];
  if (changes.added.length) parts.push(`${changes.added.length} added`);
  if (changes.updated.length) parts.push(`${changes.updated.length} updated`);
  if (changes.removed.length) parts.push(`${changes.removed.length} removed`);
  return parts.join(', ') || 'no changes';
}

// ─── Local preview ──────────────────────────────────────────────────────────

function readPreviewState() {
  try { return JSON.parse(fs.readFileSync(PREVIEW_STATE, 'utf8')); } catch { return null; }
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function runningPreview() {
  const st = readPreviewState();
  return st && isAlive(st.pid) ? st : null;
}

/** Copy this checkout's code (not its content) into the preview folder, so the preview shows your local site. */
function preparePreviewCode() {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  const excludes = ['/node_modules', '/.git', '/dist', '/.astro', ...OWNED.map((p) => `/${p}`)].flatMap((e) => ['--exclude', e]);
  execFileSync('rsync', ['-a', '--delete', ...excludes, `${THIS_REPO}/`, `${PREVIEW_DIR}/`]);
  const modules = path.join(PREVIEW_DIR, 'node_modules');
  if (!fs.existsSync(modules)) fs.symlinkSync(path.join(THIS_REPO, 'node_modules'), modules);
}

function buildPreview() {
  const state = loadState();
  const result = generate(state, { target: 'preview' });
  writeInto(PREVIEW_DIR, result.files);
  saveState(state);
  return result;
}

function writePreviewNote({ running, startedAt, result, message }) {
  const lines = [
    '# Website preview',
    '',
    "> Rewritten automatically. Never published. Nothing here changes the live website.",
    '',
    running
      ? `**Preview: running** at ${PREVIEW_URL} (started ${formatStamp(new Date(startedAt))}). It stops by itself after ${IDLE_MINUTES} minutes without visits or edits.`
      : '**Preview: stopped.**',
    '',
    `**[Start or refresh the preview](zsite://preview/start) · [Stop the preview](zsite://preview/stop)**`,
    '',
    "While it's running, edits you save in PUBLIC_WEBSITE show up in the browser within a few seconds.",
    '',
  ];
  if (message) lines.push(`> ${message.replace(/\n/g, '\n> ')}`, '');

  lines.push('## Marked `publish: preview`', '');
  const marked = result ? [...result.pages.filter((p) => p.preview), ...result.items.filter((i) => i.preview)] : [];
  if (!result) lines.push('_Start the preview to list them._');
  else if (!marked.length) lines.push('_None. Add `publish: preview` to a note to see it here without publishing it._');
  else for (const p of marked) lines.push(`- ${p.title} (${p.section.label}): ${PREVIEW_URL}${pagePath(p)}`);
  lines.push('');

  lines.push('## Main pages', '');
  lines.push(['Home: /', 'Projects: /projects', 'Writing: /writing/essays', 'Notes: /writing/notes']
    .map((l) => { const [name, p] = l.split(': '); return `[${name}](${PREVIEW_URL}${p})`; }).join(' · '));
  lines.push('');

  lines.push('## Publish', '');
  const state = fs.existsSync(PUBLIC_DIR) ? loadState() : {};
  const year = new Date().getFullYear();
  const thisYear = (state.publishes ?? []).filter((t) => new Date(t).getFullYear() === year).length;
  const last = state.lastPublish ? new Date(state.lastPublish) : null;
  const lastCheck = state.lastSuccess ? new Date(state.lastSuccess) : null;
  const next = !fs.existsSync(SCHEDULE_PLIST) ? 'not scheduled yet'
    : lastCheck ? `on or after ${formatDay(new Date(lastCheck.getTime() + INTERVAL_DAYS * 86400e3))}` : 'at the next scheduled check';
  lines.push(`Website updates from Obsidian in ${year}: **${thisYear}**`);
  lines.push(`Last update: ${last ? formatStamp(last) : 'never'} · Next automatic update: ${next}`);
  lines.push('');
  lines.push('**[Publish now](zsite://publish)**: shows what would change and asks you to confirm before anything goes live. It only deploys if something actually changed.');
  lines.push('');

  if (result?.problems.length) {
    lines.push('## Warnings', '');
    for (const p of result.problems) lines.push(`- ${p}`);
    lines.push('');
  }
  fs.writeFileSync(path.join(PUBLIC_DIR, PREVIEW_NOTE), lines.join('\n'));
}

function waitForPreview(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port: ASTRO_PORT, path: '/' }, (res) => { res.resume(); resolve(true); });
      req.on('error', () => (Date.now() > deadline ? resolve(false) : setTimeout(attempt, 500)));
    };
    attempt();
  });
}

async function previewStart() {
  const running = runningPreview();
  preparePreviewCode();
  const result = buildPreview();

  // Refresh the status note with what a real sync would change.
  try {
    const { live, blobs } = liveSnapshot(THIS_REPO);
    const state = loadState();
    const liveRun = generate(state, { target: 'live', liveFiles: blobs, live });
    const changes = compare(liveRun.pages, liveRun.items, liveRun.files, live);
    writeStatus({ mode: 'preview', outcome: `preview started, nothing published (the next sync would be: ${summary(changes)})`, state, pages: [...liveRun.pages, ...liveRun.items], skipped: liveRun.skipped, problems: liveRun.problems, changes });
  } catch (err) {
    log(`preview: couldn't compare with the live site (${err.message.split('\n')[0]})`);
  }

  let startedAt = running?.startedAt;
  if (!running) {
    const out = fs.openSync(path.join(WORK_DIR, 'preview-server.log'), 'a');
    spawn(process.execPath, [fileURLToPath(import.meta.url), 'preview-serve'], { detached: true, stdio: ['ignore', out, out] }).unref();
    startedAt = new Date().toISOString();
    if (!(await waitForPreview(90e3))) throw new Error(`The preview server didn't start. See ${path.join(WORK_DIR, 'preview-server.log')}.`);
  }
  writePreviewNote({ running: true, startedAt, result });
  execFileSync('open', [PREVIEW_URL]);
  log(`preview: ${running ? 'refreshed' : 'started'} at ${PREVIEW_URL}`);
}

async function previewStop() {
  const st = readPreviewState();
  if (st && isAlive(st.pid)) {
    process.kill(st.pid, 'SIGTERM');
    for (let i = 0; i < 20 && isAlive(st.pid); i++) await new Promise((r) => setTimeout(r, 250));
    if (isAlive(st.pid)) process.kill(st.pid, 'SIGKILL');
  }
  // Make sure nothing is left on the preview ports.
  for (const port of [PREVIEW_PORT, ASTRO_PORT]) {
    try {
      for (const pid of execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
        process.kill(Number(pid), 'SIGTERM');
      }
    } catch { /* nothing listening */ }
  }
  fs.rmSync(PREVIEW_STATE, { force: true });
  writePreviewNote({ running: false });
  log('preview: stopped');
}

/** The long-running preview process: Astro's dev server behind a small proxy that notices visits. */
function previewServe() {
  const astro = spawn(process.execPath, [path.join(PREVIEW_DIR, 'node_modules/astro/astro.js'), 'dev', '--port', String(ASTRO_PORT), '--host', '127.0.0.1'],
    { cwd: PREVIEW_DIR, stdio: ['ignore', 'inherit', 'inherit'] });
  let lastActivity = Date.now();
  let stopping = false;
  const startedAt = new Date().toISOString();

  const starting = '<!doctype html><meta http-equiv="refresh" content="2"><body style="font:16px Georgia,serif;padding:40px">Starting the preview…</body>';
  const server = http.createServer((req, res) => {
    lastActivity = Date.now();
    const upstream = http.request({ host: '127.0.0.1', port: ASTRO_PORT, path: req.url, method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(503, { 'content-type': 'text/html' }); res.end(starting); });
    req.pipe(upstream);
  });
  // Pass websocket upgrades through so the page live-reloads on edits.
  server.on('upgrade', (req, socket, head) => {
    const upstream = net.connect(ASTRO_PORT, '127.0.0.1', () => {
      const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
      upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });
  server.listen(PREVIEW_PORT, '127.0.0.1');
  fs.writeFileSync(PREVIEW_STATE, JSON.stringify({ pid: process.pid, startedAt }));

  const shutdown = (why) => {
    if (stopping) return;
    stopping = true;
    astro.kill('SIGTERM');
    server.close();
    fs.rmSync(PREVIEW_STATE, { force: true });
    try { writePreviewNote({ running: false, message: why }); } catch { /* vault missing */ }
    log(`preview: stopped (${why})`);
    setTimeout(() => process.exit(0), 500);
  };
  process.on('SIGTERM', () => shutdown('Stopped.'));
  process.on('SIGINT', () => shutdown('Stopped.'));
  astro.on('exit', () => shutdown('The dev server exited. Start the preview again.'));
  setInterval(() => {
    if (Date.now() - lastActivity > IDLE_MINUTES * 60e3) shutdown(`Stopped automatically after ${IDLE_MINUTES} minutes without visits or edits.`);
  }, 60e3);

  // Rebuild the preview content whenever something in PUBLIC_WEBSITE (or an attachment) changes.
  let timer;
  const onChange = (name) => {
    if (!name || OWN_FILES.test(name)) return;
    lastActivity = Date.now();
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const result = buildPreview();
        writePreviewNote({ running: true, startedAt, result });
        log('preview: rebuilt after an edit');
      } catch (err) {
        writePreviewNote({ running: true, startedAt, message: `The last edit couldn't be previewed: ${err.message}` });
        log(`preview: rebuild failed (${err.message.split('\n')[0]})`);
      }
    }, 800);
  };
  fs.watch(PUBLIC_DIR, { recursive: true }, (_, name) => onChange(name));
  const attachments = path.join(VAULT, 'Attachments');
  if (fs.existsSync(attachments)) fs.watch(attachments, { recursive: true }, (_, name) => onChange(`Attachments/${name}`));
}

function ensureClone() {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  if (!fs.existsSync(path.join(CLONE_DIR, '.git'))) {
    execFileSync('git', ['clone', '--quiet', REMOTE, CLONE_DIR], { stdio: 'inherit' });
  }
  git(CLONE_DIR, 'fetch', '--quiet', 'origin');
  git(CLONE_DIR, 'reset', '--quiet', '--hard', 'origin/main');
  git(CLONE_DIR, 'clean', '-fdq');

  const lockHash = sha(fs.readFileSync(path.join(CLONE_DIR, 'package-lock.json')));
  const stamp = path.join(WORK_DIR, 'installed-lock-hash');
  const installed = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : '';
  if (!fs.existsSync(path.join(CLONE_DIR, 'node_modules')) || installed !== lockHash) {
    execFileSync('npm', ['ci', '--silent'], { cwd: CLONE_DIR, stdio: 'inherit' });
    fs.writeFileSync(stamp, lockHash);
  }
}

/** Publishing builds from the code on GitHub, so that code has to understand the generated files. */
function checkCloneCode() {
  if (!fs.existsSync(path.join(CLONE_DIR, 'scripts/sync-obsidian.mjs'))) {
    throw new Error("The website's code on GitHub doesn't include the Obsidian sync yet, so nothing was published. Commit and push the site code first.");
  }
}

function publish(force) {
  const state = loadState();
  ensureClone();
  checkCloneCode();
  const { live, blobs } = liveSnapshot(CLONE_DIR);
  const { pages, items, skipped, problems, files } = generate(state, { target: 'live', liveFiles: blobs, live });
  const changes = compare(pages, items, files, live);
  guardRemovals(changes, live, force);
  writeInto(CLONE_DIR, files);

  const dirty = git(CLONE_DIR, 'status', '--porcelain', '--', ...OWNED);
  if (!dirty) {
    state.lastSuccess = new Date().toISOString();
    saveState(state);
    writeStatus({ mode: 'publish', outcome: 'OK, nothing had changed, so nothing was deployed', state, pages: [...pages, ...items], skipped, problems });
    log('publish: nothing changed');
    return;
  }

  try {
    execFileSync('npm', ['run', 'build', '--silent'], { cwd: CLONE_DIR, stdio: 'pipe' });
  } catch (err) {
    const out = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n');
    throw new Error(`The site failed to build with these changes, so nothing was pushed.\n\n${out}`);
  }

  git(CLONE_DIR, 'add', '-A', '--', ...OWNED);
  git(CLONE_DIR, 'commit', '--quiet', '-m', `Sync from Obsidian: ${summary(changes)}`);
  git(CLONE_DIR, 'push', '--quiet', 'origin', 'HEAD:main');
  const commit = git(CLONE_DIR, 'rev-parse', 'HEAD');

  state.lastSuccess = new Date().toISOString();
  state.lastPublish = state.lastSuccess;
  state.publishes = [...(state.publishes ?? []), state.lastSuccess];
  saveState(state);
  appendChangelog(changes, commit);
  writeStatus({ mode: 'publish', outcome: `OK, published (${summary(changes)}), commit ${commit.slice(0, 7)}`, state, pages: [...pages, ...items], skipped, problems });
  log(`publish: ${summary(changes)} -> ${commit.slice(0, 7)}`);
  notify(`Website updated: ${summary(changes)}`);
}

/** The "Publish now" link: show what would change, ask, then publish. */
function publishNow(force) {
  const state = loadState();
  ensureClone();
  checkCloneCode();
  const { live, blobs } = liveSnapshot(CLONE_DIR);
  const run = generate(state, { target: 'live', liveFiles: blobs, live });
  const changes = compare(run.pages, run.items, run.files, live);
  if (!changes.added.length && !changes.updated.length && !changes.removed.length) {
    notify('Nothing to publish: the website already matches Obsidian.');
    log('publish-now: nothing to publish');
    return;
  }
  const list = [
    ...changes.added.map((p) => `+ ${p.title} (${p.section.label})`),
    ...changes.updated.map((p) => `~ ${p.title} (${p.section.label})`),
    ...changes.removed.map((p) => `- ${p.title} (${p.section.label})`),
  ];
  const shown = list.slice(0, 12).join('\n') + (list.length > 12 ? `\n…and ${list.length - 12} more` : '');
  const message = `Publish ${summary(changes)} to the live website now?\n\n${shown}`;
  try {
    execFileSync('osascript', ['-e', `display dialog ${JSON.stringify(message)} with title "Publish website" buttons {"Cancel", "Publish"} default button "Publish" cancel button "Cancel"`]);
  } catch {
    log('publish-now: cancelled');
    return;
  }
  publish(force);
  writePreviewNote({ running: Boolean(runningPreview()), startedAt: runningPreview()?.startedAt });
}

async function main() {
  const args = process.argv.slice(2);
  let mode = args.find((a) => !a.startsWith('--')) ?? 'preview-start';
  if (mode === 'link') {
    // zsite://preview/start and friends, from the helper app.
    const target = (args[1] ?? '').replace(/^zsite:\/\//, '').replace(/\/+$/, '');
    mode = LINKS[target];
    if (!mode) { log(`link: unknown link "${args[1]}"`); return; }
  }
  const force = args.includes('--force');

  if (mode === 'scheduled') {
    const state = fs.existsSync(PUBLIC_DIR) ? loadState() : {};
    const last = state.lastSuccess ? new Date(state.lastSuccess) : null;
    if (last && Date.now() - last.getTime() < INTERVAL_DAYS * 86400e3) {
      log(`scheduled: last sync ${formatStamp(last)}, not due yet`);
      return;
    }
  }

  try {
    if (mode === 'preview-start' || mode === 'preview') await previewStart();
    else if (mode === 'preview-stop') await previewStop();
    else if (mode === 'preview-serve') previewServe();
    else if (mode === 'publish' || mode === 'scheduled') publish(force);
    else if (mode === 'publish-now') publishNow(force);
    else throw new Error(`Unknown mode "${mode}". Use preview-start, preview-stop, publish or scheduled.`);
  } catch (err) {
    log(`FAILED (${mode}): ${err.message}`);
    notify(`${mode.startsWith('preview') ? 'Preview' : 'Sync'} failed: ${err.message.split('\n')[0]}`);
    if (fs.existsSync(PUBLIC_DIR)) {
      if (mode.startsWith('preview')) {
        try { writePreviewNote({ running: Boolean(runningPreview()), startedAt: runningPreview()?.startedAt, message: `Failed: ${err.message}` }); } catch { /* best effort */ }
      } else markStatusFailed(err.message);
    }
    process.exitCode = 1;
  }
}

main();
