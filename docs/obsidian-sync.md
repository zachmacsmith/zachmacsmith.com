# Obsidian → website sync

The site's essays, notes, projects and page text are written in Obsidian, in
`~/Documents/obsidian/ObsidianPersonal/PUBLIC_WEBSITE/`, and copied into this repo by
`scripts/sync-obsidian.mjs`. Obsidian is the source of truth: the generated files below are
overwritten on every sync, so edit the notes, not these files.

| Vault folder | Becomes |
| --- | --- |
| `WRITING_WEBSITE/` | `src/content/essays/` and `public/images/essays/` |
| `NOTES_WEBSITE/` | `src/content/notes/` and `public/images/notes/` |
| `PROJECTS_WEBSITE/` | `src/data/projects.json`, `public/images/projects/`, `public/videos/` |
| `SITE_TEXT/` | `src/data/site-copy.md`, `src/data/home-intro.md` |

`src/data/sync-manifest.json` records what was published, so each sync can report what changed.

## Publishing a note

Every note needs a `publish` property:

- `live`: on the website.
- `preview`: only in the local preview. If the page is already live, the live version is kept.
- `off`, empty or missing: ignored.

The `SITE_TEXT` notes are always live; give one `publish: preview` to hold back an edit.

Other properties (all optional):

- Essays and notes: `title` (defaults to the filename), `date` (defaults to when the file was created),
  `updated`, `description`, `tags`, `status`, `slug`.
- Projects: `order`, `description`, `status`, `year`, `image`, `video`, `image_alt`, `caption`,
  `image_focus`, `starred`, `recognition`, `tags`, `github`, `pypi`, `paper`, `demo`, `essay`, `link`.
  The note body is the project's description on /projects.
- `SITE_TEXT`: `heading` (required on Projects, Writing, Notes and Page not found), `tab_title`;
  `Site.md` has `name` and `description`; `Home.md` has `projects_heading` and `writing_heading`.

## Commands

```bash
npm run sync:preview        # start or refresh the local preview at http://localhost:4322
npm run sync:preview-stop   # stop it
npm run sync:publish        # publish now, without the confirmation dialog
```

To set up on a new Mac: `./scripts/install-preview-link.sh`, then `./scripts/install-schedule.sh`.

The links in `PUBLIC_WEBSITE/_Site preview.md` do the same: Start, Stop and Publish now
(which asks you to confirm first). The preview stops by itself after 60 minutes without visits
or edits.

## What this installs on the Mac

Nothing here lives in the vault or this repo except the notes and scripts listed above.

| Path | What it is | Created by |
| --- | --- | --- |
| `~/Applications/Website Preview.app` | Handles `zsite://` links from Obsidian. Runs only when a link is clicked. | `scripts/install-preview-link.sh` |
| `~/.website-sync/` | Working folder: the preview copy of the site (`preview/`), the publishing copy (`zachmacsmith.com/`) and logs. | The sync script |
| `~/Library/LaunchAgents/com.zachmacsmith.website-sync.plist` | The automatic sync: checks daily at 7pm and at login, publishes if the last sync was 3+ days ago and something changed. Logs to `~/.website-sync/schedule.log` and `sync.log`. | `scripts/install-schedule.sh` |
| Documents folder access for "Website Preview" | macOS permission, granted the first time a link is clicked. | macOS |

In the vault, the sync also writes `PUBLIC_WEBSITE/_Site status.md`, `_Site preview.md`,
`_Site changelog.md` and the hidden `PUBLIC_WEBSITE/.sync-state.json`, and the `publish`
property is set to Text in `.obsidian/types.json`.

### Removing it

```bash
./scripts/uninstall-obsidian-sync.sh
```

That stops the preview, unloads the schedule if it's installed, and deletes the app and
`~/.website-sync/`. It leaves the vault and this repo alone. To also revoke the Documents permission,
remove "Website Preview" in System Settings → Privacy & Security → Files and Folders.
