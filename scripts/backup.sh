#!/usr/bin/env bash
# Back up server/data (SQLite database + uploaded KYC documents).
# Takes a consistent SQLite snapshot inside the running container, then archives the data folder.
# Usage: scripts/backup.sh [backup-dir]   (default ~/backups/wifi-et, keeps the newest 14)
set -euo pipefail
cd "$(dirname "$0")/.."
DEST="${1:-$HOME/backups/wifi-et}"
KEEP=14
mkdir -p "$DEST" && chmod 700 "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"

docker exec wifiet-server node --disable-warning=ExperimentalWarning -e '
  const { DatabaseSync, backup } = require("node:sqlite");
  backup(new DatabaseSync("data/wifiet.db"), "data/snapshot.db").then(() => {}, (e) => { console.error(e); process.exit(1); });
'
# Archive everything except the live database files; the snapshot stands in for them.
umask 077
tar -czf "$DEST/wifiet-$STAMP.tar.gz" -C server/data --exclude='wifiet.db' --exclude='wifiet.db-*' .
rm -f server/data/snapshot.db
ls -1t "$DEST"/wifiet-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "backup: $DEST/wifiet-$STAMP.tar.gz"
