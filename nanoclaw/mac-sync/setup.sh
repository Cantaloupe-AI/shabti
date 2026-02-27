#!/usr/bin/env bash
#
# setup.sh — One-time setup for Apple sync on macOS
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_SRC="${SCRIPT_DIR}/com.nanoclaw.apple-sync.plist"
PLIST_DST="${HOME}/Library/LaunchAgents/com.nanoclaw.apple-sync.plist"
SYNC_SCRIPT="${SCRIPT_DIR}/apple-sync.sh"

echo "=== NanoClaw Apple Sync Setup ==="
echo

# Make sync script executable
chmod +x "$SYNC_SCRIPT"
echo "[OK] Made apple-sync.sh executable"

# Create state directory
mkdir -p "${HOME}/.config/nanoclaw"
echo "[OK] Created state directory"

# Install launchd plist with correct path
sed "s|APPLE_SYNC_PATH|${SYNC_SCRIPT}|g" "$PLIST_SRC" > "$PLIST_DST"
echo "[OK] Installed launchd plist to ${PLIST_DST}"

# Load the plist
launchctl load "$PLIST_DST" 2>/dev/null || true
echo "[OK] Loaded launchd job (runs daily at 6am)"

echo
echo "=== Remaining manual steps ==="
echo
echo "1. Grant Full Disk Access to Terminal:"
echo "   System Settings > Privacy & Security > Full Disk Access > Add Terminal"
echo
echo "2. Configure SSH access to your NanoClaw server:"
echo "   Set NANOCLAW_HOST in ~/.config/nanoclaw/env or ensure 'nanoclaw-server'"
echo "   is configured in ~/.ssh/config"
echo
echo "3. Ensure the IPC directory exists on the server:"
echo "   ssh nanoclaw-server 'mkdir -p ~/nanoclaw/data/ipc/main/apple-sync'"
echo
echo "4. Test the sync:"
echo "   ${SYNC_SCRIPT}"
echo
echo "Done!"
