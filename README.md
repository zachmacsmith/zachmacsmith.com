# Personal Website — Editing Guide

Site runs on [Astro](https://astro.build) with Tailwind CSS. Dev server: `npm run dev` from the `Personal Website/` directory.

---

## Projects

**File:** `Personal Website/src/data/projects.ts`

Add or edit entries in the array. All fields except `title`, `description`, `status`, and `tags` are optional — omit any you don't need.

```ts
{
  title: 'WISP',
  description: 'One sentence shown on the card.',
  status: 'active',           // 'active' | 'complete' | 'paused'
  tags: ['Python', 'RF'],
  github: 'https://github.com/zachmacsmith/wisp',
  pypi: 'https://pypi.org/project/...',
  paper: 'https://arxiv.org/abs/...',
  demo: 'https://youtube.com/...',
  blog: '/writing/essays/wisp',        // link to an essay writeup
  image: '/images/projects/wisp.png',  // omit for half-width card
  link: '/writing/essays/wisp',        // makes whole card clickable
},
```

**Images:** drop project screenshots into `Personal Website/public/images/projects/` and reference them as `/images/projects/filename.png`.

**Card layout:** cards with an `image` span two rows — the next two text-only cards stack beside them. Cards without an image are half-width.

---

## Essays

**Files:** `Personal Website/src/content/essays/*.md`

Create a new `.md` file — the filename becomes the URL slug.

```markdown
---
title: "Your Essay Title"
date: 2026-05-12
description: "One sentence shown in the essay list and on the homepage."
tags: [philosophy, AI]
---

Your essay content here. Supports standard markdown.
```

`/writing/essays/my-essay.md` → `yoursite.com/writing/essays/my-essay`

---

## Notes

**Files:** `Personal Website/src/content/notes/*.md`

Same as essays but simpler frontmatter — no description or read time.

```markdown
---
title: "Short title"
date: 2026-05-12
tags: [AI-safety]
---

Your note content here.
```

`/writing/notes/my-note.md` → `yoursite.com/writing/notes/my-note`

---

## Homepage

**File:** `Personal Website/src/pages/index.astro`

- **Intro paragraph** (~line 53): edit the `<p>` tag text directly.
- **Featured section** (~line 18): hardcoded array of 3 items. Edit `title`, `href`, `type`, and `description` for each. `type` must be `'Essay'`, `'Note'`, or `'Project'`.
- **Recent section**: auto-generated — shows the last 5 essays and notes by date, no editing needed.

---

## Section subtitles

Each section has a one-line subtitle beneath the heading:

| Page | File |
|------|------|
| Projects | `src/pages/projects.astro` ~line 10 |
| Essays | `src/pages/writing/essays/index.astro` ~line 14 |
| Notes | `src/pages/writing/notes/index.astro` ~line 13 |

---

## Navigation & footer

- **Nav site name / links:** `Personal Website/src/components/Nav.astro`
- **Footer GitHub link:** `Personal Website/src/components/Footer.astro`

---

## 404 page

**File:** `Personal Website/src/pages/404.astro` — edit the heading and body text directly.

---

## Colors

All section colors are CSS variables in `Personal Website/src/styles/global.css`. Four palettes: homepage (neutral), projects (Taupo blue), essays (spring teal-green), notes (deep bush brown). Each has a matching dark mode variant that activates automatically via `prefers-color-scheme`.

---

## Dark mode

Follows system preference by default. The `auto` / `light` / `dark` toggle in the nav lets visitors override it manually — their choice is saved in `localStorage`.

---

## Adding a project image

1. Copy the image into `Personal Website/public/images/projects/`
2. Add `image: '/images/projects/yourfile.png'` to the project entry in `projects.ts`

---

## Deploying

Push to GitHub. Connect the repo to Netlify or Vercel (one-time setup). After that, every push to `main` triggers an automatic rebuild (~30s).
