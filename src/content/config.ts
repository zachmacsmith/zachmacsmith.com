import { defineCollection, z } from 'astro:content';

// Both collections are generated from Obsidian by scripts/sync-obsidian.mjs.
const page = z.object({
  title: z.string(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** Free-text label shown under the title, e.g. "thinking out loud". */
  status: z.string().optional(),
  /** Only set in the local preview, for pages marked `publish: preview`. */
  preview: z.boolean().optional(),
});

const essays = defineCollection({ type: 'content', schema: page });
const notes = defineCollection({ type: 'content', schema: page });

export const collections = { essays, notes };
