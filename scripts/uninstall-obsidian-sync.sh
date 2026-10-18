#!/bin/zsh
# Removes everything the Obsidian sync installed on this Mac (see docs/obsidian-sync.md).
# Leaves the vault and this repo untouched.
set -uo pipefail

REPO="${0:A:h:h}"
APP="$HOME/Applications/Website Preview.app"
PLIST="$HOME/Library/LaunchAgents/com.zachmacsmith.website-sync.plist"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

node "$REPO/scripts/sync-obsidian.mjs" preview-stop 2>/dev/null || true

if [[ -f "$PLIST" ]]; then
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Removed the automatic sync schedule"
fi

if [[ -d "$APP" ]]; then
  "$LSREGISTER" -u "$APP" 2>/dev/null || true
  rm -rf "$APP"
  echo "Removed $APP"
fi

rm -rf "$HOME/.website-sync"
echo "Removed ~/.website-sync"
echo "To revoke its Documents access: System Settings → Privacy & Security → Files and Folders."
