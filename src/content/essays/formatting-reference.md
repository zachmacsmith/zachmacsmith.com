---
title: "Formatting Reference"
date: 2026-05-12
description: "A reference essay showing every formatting element available — headings, lists, blockquotes, code, footnotes, and links."
tags: [meta]
---

This essay exists to show what every formatting element looks like. Delete it whenever you no longer need it.

## Headings

The title above is an `h1`, handled by the layout. Inside the essay body, use `##` for section headings and `###` for subsections.

### A subsection heading

Subsection headings are slightly smaller and sit closer to the content they introduce.

## Paragraph text

Body text is set in Source Serif 4 at roughly 17px with generous line height. It is comfortable for long-form reading. The measure — the width of a line — is capped at around 68 characters to prevent the eye from losing its place.

A second paragraph. Each paragraph is separated by a blank line in the markdown source. No need for manual spacing.

## Emphasis

You can write *italic text* by wrapping in single asterisks, and **bold text** with double asterisks. You can combine them: ***bold italic*** is possible but use it sparingly. Inline `code` uses backticks and renders in IBM Plex Mono.

## Links and footnotes

Links appear in the section accent colour with a fine underline. [This is a link](https://example.com). They work mid-sentence without disrupting flow.

Footnotes use a superscript marker inline.[^1] A second footnote.[^2] The full notes render at the bottom of the page automatically.

[^1]: This is the first footnote. It can be as long as you need — it sits below the essay body, separated by a rule.
[^2]: Footnotes are numbered automatically in order of appearance, regardless of what you label them in the source.

## Lists

An unordered list:

- First item
- Second item
- Third item with a bit more text to show how wrapping looks at this measure

An ordered list:

1. First step
2. Second step
3. Third step

## Blockquotes

> A quotation from someone worth quoting. The left border and muted colour distinguish it from the running text without being heavy-handed.

You can also use blockquotes for pull quotes or asides from your own writing.

> Longer blockquotes work fine too. The line height and measure stay consistent, and the italic treatment carries through naturally if you write in *emphasis* inside a quote.

## Code

Inline code — like `grid-column: 1 / -1` or `python manage.py migrate` — uses the mono font and a surface-colour background.

A fenced code block with syntax highlighting:

```python
def embed(graph, topology):
    """Find a minor embedding of graph into topology."""
    chains = {}
    for node in graph.nodes:
        chains[node] = find_chain(node, topology)
    return chains
```

```bash
npm run dev
git push origin main
```

## Images

A basic inline image at full column width:

![WISP project screenshot](/images/projects/wisp.png)

With a caption using a figure element:

<figure>
  <img src="/images/projects/wisp.png" alt="WISP project screenshot" />
  <figcaption>An optional caption sits below the image in muted text.</figcaption>
</figure>

## Horizontal rule

A rule separates distinct sections when a heading would feel too heavy.

---

Text continues after the rule. Rules are subtle — a single thin line in the border colour.

## A note on nesting

Lists can be nested, though more than one level deep rarely helps:

- Top level
  - One level of nesting is readable
  - Keep it to this depth
- Back at the top

That covers everything the current stylesheet handles. Markdown source for this essay is at `src/content/essays/formatting-reference.md`.
