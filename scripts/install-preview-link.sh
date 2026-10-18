#!/bin/zsh
# Installs "Website Preview.app" in ~/Applications: a tiny helper that macOS opens for zsite:// links,
# so clicking links like [Start the preview](zsite://preview/start) in Obsidian runs scripts/sync-obsidian.mjs.
# Run it again after moving this repo or reinstalling Node.
set -euo pipefail

REPO="${0:A:h:h}"
NODE="$(command -v node)"
APP="$HOME/Applications/Website Preview.app"
LOG="$HOME/.website-sync/preview-link.log"
PLIST="$APP/Contents/Info.plist"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister

mkdir -p "$HOME/Applications" "$HOME/.website-sync"

SCRIPT_FILE="$(mktemp -t website-preview).applescript"
cat > "$SCRIPT_FILE" <<EOF
on run
	-- Opened directly rather than from a link: nothing to do.
end run

on open location theURL
	-- The script decides what each zsite:// link does, so new links never need this app reinstalled.
	do shell script "{ date; cd " & quoted form of "$REPO" & " && " & quoted form of "$NODE" & " scripts/sync-obsidian.mjs link " & quoted form of theURL & "; } >> " & quoted form of "$LOG" & " 2>&1 &"
end open location
EOF

rm -rf "$APP"
osacompile -o "$APP" "$SCRIPT_FILE"
rm -f "$SCRIPT_FILE"

/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.zachmacsmith.website-preview" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.zachmacsmith.website-preview" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLName string Website preview" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string zsite" "$PLIST"

codesign --force --deep --sign - "$APP" >/dev/null 2>&1
"$LSREGISTER" -f "$APP"

echo "Installed $APP"
echo "zsite:// links now run: $NODE $REPO/scripts/sync-obsidian.mjs"
