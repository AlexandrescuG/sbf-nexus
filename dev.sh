#!/bin/bash
# ============================================================
# SBF NEXUS — Local Development Server
# ============================================================

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3000

echo ""
echo "  SBF COMPANY · NEXUS PLATFORM"
echo "  ──────────────────────────────"

# Verify core files
for f in index.html styles.css app.js; do
  if [ ! -f "$DIR/$f" ]; then
    echo "  ✗ Missing: $f"
    exit 1
  fi
  echo "  ✓ $f"
done
echo ""

# Choose server strategy
if command -v npx &>/dev/null; then
  echo "  → Launching via browser-sync on http://localhost:$PORT"
  echo ""
  cd "$DIR"
  npx browser-sync start \
    --server \
    --files "*.html,*.css,*.js" \
    --port $PORT \
    --open \
    --no-notify \
    --logLevel silent
elif python3 -c "import http.server" &>/dev/null; then
  echo "  → No Node found. Launching Python HTTP server on http://localhost:$PORT"
  echo "  → Live-reload NOT available. Refresh manually after edits."
  echo ""
  cd "$DIR"
  python3 -m http.server $PORT &
  SERVER_PID=$!
  sleep 1
  # Open browser
  if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT"
  elif command -v open &>/dev/null; then
    open "http://localhost:$PORT"
  fi
  echo "  Server PID: $SERVER_PID"
  echo "  Press Ctrl+C to stop."
  wait $SERVER_PID
else
  echo "  ✗ No server runtime found (Node/npm or Python 3 required)."
  exit 1
fi
