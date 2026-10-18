#!/bin/zsh
# Installs the automatic sync: macOS checks once a day (at 7pm, and whenever you log in) and the
# sync script publishes only if the last sync was 3+ days ago and something changed.
# It goes through the Website Preview app (zsite://sync/scheduled) so it has that app's
# Documents folder access. Install that first: scripts/install-preview-link.sh
set -euo pipefail

LABEL=com.zachmacsmith.website-sync
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.website-sync"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/open</string>
    <string>-g</string>
    <string>zsite://sync/scheduled</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>19</integer><key>Minute</key><integer>0</integer></dict>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/.website-sync/schedule.log</string>
  <key>StandardErrorPath</key><string>$HOME/.website-sync/schedule.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $PLIST (daily check at 7pm and at login; publishes every 3+ days if anything changed)"
