# Personal Website — Architecture & Design Spec

## 1. Purpose

A hub for technical projects, finished writing, and working notes. The site serves two audiences who may not overlap: technical people (researchers, hiring managers, collaborators) arriving at Projects, and humanities/philosophy readers arriving at Writing. The homepage connects both by naming the through-line between domains.

The site is a long-term artifact that grows with the work. Infrastructure must be invisible after setup — adding content is "write markdown, push."

---

## 2. Site Structure

```
Home
├── Projects          (single page, card grid)
└── Writing
    ├── Essays        (finished work — technical, philosophical, creative)
    └── Notes         (working notes, in-progress thinking, fragments)
```

**Four pages total. Two content collections.**

### Home (`/`)

- 2–3 sentence orientation: who you are, what you work on, why the threads connect. Not a biography — an answer to "what is this and why am I here?"
- Featured section: 2–3 manually selected pieces (mix of projects and writing). These are hardcoded links, not auto-generated — you choose what's prominent.
- Recent activity: auto-generated list of the last 3–5 pieces across all collections, with type labels (Essay, Note, Project Post).

### Projects (`/projects`)

Single page. No sub-pages per project — depth lives in blog posts under Writing.

Each project is a card containing:
- Title
- One-sentence description
- Status badge: `Active` / `Complete` / `Paused`
- Tech tags (e.g. `Python`, `D-Wave`, `PyTorch`)
- Links: GitHub, PyPI, paper, demo (whichever exist — hide the rest)
- Link to blog post in Writing (if one exists), clearly labeled
- Optional: screenshot or figure

Card data lives in a single file (`src/data/projects.ts` or `projects.yaml`) so adding a project means adding an entry to one file. No markdown files needed for projects unless you later want individual project pages.

### Writing — Essays (`/writing/essays`)

Index page listing all essays, sorted by date (newest first). Each entry shows:
- Title
- Date
- 1–2 sentence abstract (from frontmatter `description` field)
- Tags displayed subtly (e.g. `philosophy`, `quantum`, `fiction`, `AI`)
- Estimated read time (auto-calculated from word count)

Each essay is a markdown file in `src/content/essays/`. Clicking the title goes to the full essay page.

### Writing — Notes (`/writing/notes`)

Index page listing all notes, sorted by date (newest first). Visually distinct from Essays — lighter weight, more like a logbook. Each entry shows:
- Title (can be short/informal)
- Date
- One-liner description or first sentence
- Tags

Each note is a markdown file in `src/content/notes/`. Notes pages are simpler in layout than essays — no estimated read time, no abstract block, just the content.

---

## 3. Content Model

### Essay Frontmatter

```yaml
---
title: "On the Phenomenology of Debugging"
date: 2026-05-12
description: "Why the experience of tracking a bug through a complex system mirrors certain problems in philosophy of mind."
tags: [philosophy, programming]
featured: false          # if true, eligible for homepage feature
---
```

### Note Frontmatter

```yaml
---
title: "Corrigibility fragment — the frozen committee"
date: 2026-05-12
tags: [AI-safety, corrigibility]
---
```

### Project Entry (in `projects.yaml` or similar)

```yaml
- title: EMBER
  description: "Quantum minor embedding benchmark suite for D-Wave hardware."
  status: active           # active | complete | paused
  tags: [Python, D-Wave, quantum]
  github: https://github.com/...
  pypi: https://pypi.org/project/ember-qc/
  paper: https://arxiv.org/abs/...
  blog: /writing/essays/ember-benchmarking    # link to writeup
  image: /images/projects/ember.png           # optional
```

---

## 4. Tech Stack

| Layer        | Choice                | Rationale                                                    |
|-------------|----------------------|--------------------------------------------------------------|
| Framework   | Astro                | Markdown-native, zero JS by default, content collections     |
| Styling     | Tailwind CSS         | Utility-first, no custom CSS maintenance                     |
| Content     | Markdown (`.md`)     | Write anywhere, no CMS dependency                            |
| Hosting     | Netlify or Vercel    | Auto-deploy on push, free tier sufficient                    |
| Repository  | GitHub               | Standard, enables GitHub Pages fallback                      |
| Domain      | Custom (`zachXXX.com`) | ~$12/year, points to host via DNS                           |

### Content Workflow

```
Write essay.md  →  Place in src/content/essays/  →  git push  →  Site rebuilds (~30s)
```

No build commands needed locally unless previewing. Netlify/Vercel watches the repo and rebuilds on every push to `main`.

---

## 5. Directory Structure

```
/
├── src/
│   ├── content/
│   │   ├── essays/           # markdown files
│   │   │   ├── ember-benchmarking.md
│   │   │   └── predictive-processing-and-llms.md
│   │   └── notes/            # markdown files
│   │       ├── corrigibility-fragment-01.md
│   │       └── textual-landscapes.md
│   ├── data/
│   │   └── projects.yaml     # project card data
│   ├── layouts/
│   │   ├── Base.astro        # HTML shell, nav, footer
│   │   ├── Essay.astro       # essay page layout
│   │   └── Note.astro        # note page layout
│   ├── pages/
│   │   ├── index.astro       # homepage
│   │   ├── projects.astro    # projects grid
│   │   └── writing/
│   │       ├── essays/
│   │       │   ├── index.astro       # essay list
│   │       │   └── [...slug].astro   # individual essay
│   │       └── notes/
│   │           ├── index.astro       # note list
│   │           └── [...slug].astro   # individual note
│   ├── components/
│   │   ├── Nav.astro
│   │   ├── Footer.astro
│   │   ├── ProjectCard.astro
│   │   ├── EssayListItem.astro
│   │   ├── NoteListItem.astro
│   │   └── FeaturedSection.astro
│   └── styles/
│       └── global.css        # Tailwind base + custom properties
├── public/
│   └── images/
│       └── projects/         # project screenshots
├── astro.config.mjs
├── tailwind.config.mjs
├── package.json
└── README.md
```

---

## 6. Design Direction

### Principles

1. **Writing is the product.** Design exists to make text readable, not to impress. Typography and spacing do the heavy lifting — no decorative elements.
2. **Minimum viable structure.** Four pages. No about page, no contact form, no CV page. Add later only if genuinely needed.
3. **Two audiences, one site.** A Constellation reviewer and a philosophy reader should each find what they came for within one click of the homepage.

### Aesthetic

Clean, typographic, slightly editorial. Not academic-template sterile, not tech-startup flashy. Closer to gwern.net's seriousness than to a portfolio template's polish. Dark and light mode supported.

**Typography:**
- Body: A readable serif or humanist sans-serif. Not Inter, not system fonts. Something with character — e.g. `Newsreader`, `Source Serif 4`, `Literata`, or `Instrument Serif` for body. Pair with a clean sans for headings/nav if using serif body, or vice versa.
- Generous line height (1.6–1.75 for body text).
- Max content width: ~680px for prose, ~1000px for project grid.
- Font size: 18–19px body on desktop.

**Color:**
- Restrained. One accent color for links and interactive elements. Otherwise near-black on near-white (light mode) / near-white on near-black (dark mode).
- No gradients, no color blocks, no hero images.

**Spacing:**
- Generous whitespace between sections.
- Cards on Projects page use consistent spacing, not packed tight.

**Navigation:**
- Top bar: site name (left), `Projects` | `Essays` | `Notes` (right).
- No hamburger menu — three links don't need one.
- Current section highlighted.

**Status badges on project cards:**
- `Active` — subtle green
- `Complete` — neutral gray
- `Paused` — subtle amber
- Small, pill-shaped, not attention-grabbing.

### What to avoid

- Hero sections, full-width images, parallax, animations
- "About me" photo grids
- Social media icon rows
- Newsletter signup prompts
- Any element that exists because portfolio templates include it rather than because the content requires it

---

## 7. Page Specifications

### Homepage

```
[Nav]

Zach [Surname]

[2–3 sentences: orientation paragraph with through-line]

Featured
─────────
[Card/link to featured piece 1]
[Card/link to featured piece 2]
[Card/link to featured piece 3]

Recent
─────────
[Auto-generated list: title, type label, date — last 5 across all collections]

[Footer]
```

### Projects Page

```
[Nav]

Projects
[Optional one-liner subtitle]

[Card Grid — 1 column on mobile, 2 on desktop]

  ┌──────────────────────────┐
  │ [Image/screenshot]       │
  │ Title            [Active]│
  │ One-sentence description │
  │ Python · D-Wave · quantum│
  │ GitHub | Paper | Blog →  │
  └──────────────────────────┘

[Footer]
```

### Essay Index

```
[Nav]

Essays

[List of essays, each entry:]

  Title                                    12 min read
  One-sentence description
  May 2026 · philosophy, AI
  ─────────────────────────────────────

[Footer]
```

### Note Index

```
[Nav]

Notes

[List of notes, lighter weight:]

  May 12, 2026 · Corrigibility fragment — the frozen committee
  May 8, 2026  · On textual landscapes and model phenomenology

[Footer]
```

### Individual Essay Page

```
[Nav]

Title
May 2026 · 12 min read · philosophy, AI

[Body — markdown rendered, max-width 680px]

[Footer]
```

### Individual Note Page

```
[Nav]

Title
May 12, 2026 · working note

[Body — markdown rendered, max-width 680px]

[Footer]
```

---

## 8. Deployment

1. Push repo to GitHub.
2. Connect repo to Netlify (or Vercel) — one-click setup.
3. Set custom domain in Netlify dashboard and point DNS.
4. Every push to `main` triggers rebuild and deploy (~30s).

No CI/CD configuration needed — Netlify auto-detects Astro and runs the build.

---

## 9. Future Additions (Not Now)

These are explicitly deferred. Don't build them until the content justifies them:

- RSS feed (add when there are 5+ essays)
- Search (add when there are 20+ pieces total)
- Tag filtering pages (add when tags are actually useful for navigation)
- About page (add only if the homepage orientation paragraph isn't sufficient)
- CV page (add only if needed for a specific application)
- Analytics (add only if you actually want the data — it's a distraction otherwise)

---

## 10. Open Decisions

- [ ] Domain name
- [ ] Exact typeface pairing
- [ ] Whether project images are screenshots, diagrams, or skipped initially
- [ ] Light-only vs. dark/light toggle from day one
- [ ] Hosting: Netlify vs. Vercel (both work, minor preference differences)