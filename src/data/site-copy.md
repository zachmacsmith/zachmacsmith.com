---
# ─────────────────────────────────────────────────────────────
#  ALL SITE COPY LIVES HERE.
#  Edit the values below and rebuild — nothing else to touch.
#
#  siteName      appended to every browser-tab title
#  metaDescription  default <meta description> for search/social
#
#  Per page:
#    tabTitle   what shows in the browser tab (siteName is added
#               automatically, except on home). Optional — if you
#               leave it out, `heading` is used instead.
#    heading    the <h1> at the top of the page
#    subtitle   the smaller line under the heading
# ─────────────────────────────────────────────────────────────

siteName: Zach Macaskill-Smith
metaDescription: Personal website of Zach Macaskill-Smith — projects, essays, and notes.

home:
  tabTitle: Zach Macaskill-Smith
  intro: I work on quantum computing and AI and some other stuff. I made this website.
  featuredHeading: Selected
  recentHeading: Recent

projects:
  tabTitle: Projects
  heading: Projects
  subtitle: "I built some stuff:"

essays:
  tabTitle: Essays
  heading: Essays
  subtitle: Finished pieces of writing, technical or not.

notes:
  tabTitle: Notes
  heading: Notes
  subtitle: Working thoughts, fragments, and in-progress ideas.

notFound:
  tabTitle: "404"
  eyebrow: "404"
  heading: Page not found
  subtitle: This page doesn't exist or hasn't been written yet.
  backLink: ← Back to home
---

Everything above the `---` markers is the site's copy. This text below the
frontmatter is ignored by the build, so use it for your own notes.

Titles for individual essays and notes are **not** here — those live in each
piece's own frontmatter (`src/content/essays/*.md`), so a page and its listing
can never disagree. Same for project cards, which come from `src/data/projects.ts`.
