#!/usr/bin/env bash
#
# apple-sync.sh — Extract iMessage and call metadata from macOS, SCP to NanoClaw
#
# Reads Apple's chat.db and CallHistory databases for metadata only (no message content).
# Maintains incremental sync state to avoid re-sending old records.
#
# Prerequisites:
#   - Full Disk Access granted to Terminal (or iTerm2)
#   - SSH key configured for NANOCLAW_HOST
#
set -euo pipefail

# --- Configuration ---
NANOCLAW_HOST="${NANOCLAW_HOST:-nanoclaw-server}"
NANOCLAW_PATH="${NANOCLAW_PATH:-~/nanoclaw/data/ipc/main/apple-sync}"
STATE_DIR="${HOME}/.config/nanoclaw"
STATE_FILE="${STATE_DIR}/apple-sync-state.json"
MESSAGES_DB="${HOME}/Library/Messages/chat.db"
CALLS_DB="${HOME}/Library/Application Support/CallHistoryDB/CallHistory.storedata"

# --- Init state ---
mkdir -p "$STATE_DIR"

if [[ ! -f "$STATE_FILE" ]]; then
  echo '{"imessage_last_ts": 0, "calls_last_ts": 0}' > "$STATE_FILE"
fi

IMESSAGE_LAST_TS=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['imessage_last_ts'])")
CALLS_LAST_TS=$(python3 -c "import json; print(json.load(open('$STATE_FILE'))['calls_last_ts'])")

DATE_TAG=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="${STATE_DIR}/sync-${DATE_TAG}.json"

# --- Extract iMessage metadata ---
# chat.db uses Apple's Core Data timestamp: seconds since 2001-01-01 * 1e9
# We convert to Unix epoch for portability
IMESSAGES_JSON="[]"
IMESSAGE_MAX_TS="$IMESSAGE_LAST_TS"

if [[ -f "$MESSAGES_DB" ]]; then
  IMESSAGES_JSON=$(sqlite3 -json "$MESSAGES_DB" "
    SELECT
      h.id AS handle,
      m.date AS raw_ts,
      strftime('%Y-%m-%dT%H:%M:%SZ', (m.date / 1000000000) + 978307200, 'unixepoch') AS timestamp,
      m.is_from_me,
      CASE WHEN c.chat_identifier LIKE 'chat%' THEN 1 ELSE 0 END AS is_group,
      c.chat_identifier AS chat_id
    FROM message m
    JOIN handle h ON m.handle_id = h.ROWID
    LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
    LEFT JOIN chat c ON cmj.chat_id = c.ROWID
    WHERE m.date > ${IMESSAGE_LAST_TS}
    ORDER BY m.date
  " 2>/dev/null || echo "[]")

  # Get the max timestamp for state tracking
  if [[ "$IMESSAGES_JSON" != "[]" ]]; then
    IMESSAGE_MAX_TS=$(sqlite3 "$MESSAGES_DB" "
      SELECT MAX(m.date) FROM message m WHERE m.date > ${IMESSAGE_LAST_TS}
    " 2>/dev/null || echo "$IMESSAGE_LAST_TS")
  fi
fi

# --- Extract call metadata ---
# CallHistory.storedata uses Core Data timestamp: seconds since 2001-01-01
CALLS_JSON="[]"
CALLS_MAX_TS="$CALLS_LAST_TS"

if [[ -f "$CALLS_DB" ]]; then
  CALLS_JSON=$(sqlite3 -json "$CALLS_DB" "
    SELECT
      ZADDRESS AS phone_number,
      strftime('%Y-%m-%dT%H:%M:%SZ', ZDATE + 978307200, 'unixepoch') AS timestamp,
      ZDATE AS raw_ts,
      ZDURATION AS duration_seconds,
      CASE WHEN ZORIGINATED = 1 THEN 'outbound' ELSE 'inbound' END AS direction,
      CASE WHEN ZCALLTYPE = 16 THEN 1 ELSE 0 END AS is_facetime
    FROM ZCALLRECORD
    WHERE ZDATE > ${CALLS_LAST_TS}
    ORDER BY ZDATE
  " 2>/dev/null || echo "[]")

  if [[ "$CALLS_JSON" != "[]" ]]; then
    CALLS_MAX_TS=$(sqlite3 "$CALLS_DB" "
      SELECT MAX(ZDATE) FROM ZCALLRECORD WHERE ZDATE > ${CALLS_LAST_TS}
    " 2>/dev/null || echo "$CALLS_LAST_TS")
  fi
fi

# --- Count records ---
IMESSAGE_COUNT=$(echo "$IMESSAGES_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
CALLS_COUNT=$(echo "$CALLS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

TOTAL=$((IMESSAGE_COUNT + CALLS_COUNT))
if [[ "$TOTAL" -eq 0 ]]; then
  echo "No new records since last sync. Skipping."
  exit 0
fi

# --- Build output JSON ---
cat > "$OUTPUT_FILE" <<ENDJSON
{
  "type": "apple_sync",
  "synced_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "imessages": ${IMESSAGES_JSON},
  "calls": ${CALLS_JSON}
}
ENDJSON

echo "Extracted ${IMESSAGE_COUNT} iMessages, ${CALLS_COUNT} calls"

# --- SCP to NanoClaw ---
scp "$OUTPUT_FILE" "${NANOCLAW_HOST}:${NANOCLAW_PATH}/sync-${DATE_TAG}.json"
echo "Synced to ${NANOCLAW_HOST}"

# --- Update state ---
python3 -c "
import json
state = {'imessage_last_ts': ${IMESSAGE_MAX_TS}, 'calls_last_ts': ${CALLS_MAX_TS}}
with open('$STATE_FILE', 'w') as f:
    json.dump(state, f)
"

# Clean up local file
rm -f "$OUTPUT_FILE"

echo "Done. State updated."
