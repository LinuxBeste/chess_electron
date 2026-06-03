#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PORT="${PORT:-25566}"
TUNNEL="${TUNNEL:-}"

usage() {
  cat <<EOF
Usage: $0 [--native | -n] [--tunnel <tool>] [--port <num>]

Start the chess-api server.

Options:
  --native, -n      Run natively (npm run dev) instead of Docker
  --tunnel <tool>   Expose via tunnel (ngrok | cloudflared)
  --port <num>      Host port (default: 25566, maps to container port 3000)
  --help, -h        Show this help

Examples:
  $0                          # Docker on port 25566
  $0 --native                 # npm run dev on port 3000
  $0 --tunnel cloudflared     # Docker + cloudflare tunnel
  $0 --native --tunnel ngrok  # Native + ngrok tunnel
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --native|-n) MODE="native"; shift ;;
    --tunnel) TUNNEL="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --help|-h) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

export PORT

start_tunnel() {
  local local_port="$1"
  case "$TUNNEL" in
    ngrok)
      echo "Starting ngrok tunnel on port $local_port ..."
      ngrok http "$local_port" --log=stdout 2>/dev/null &
      sleep 2
      local url
      url=$(curl -s http://127.0.0.1:4040/api/tunnels | python3 -c "import sys,json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2>/dev/null || true)
      if [[ -n "$url" ]]; then
        echo "Tunnel URL: $url"
        echo "Start the client with: CHESS_SERVER_URL=$url"
      fi
      ;;
    cloudflared)
      echo "Starting cloudflared tunnel on port $local_port ..."
      cloudflared tunnel --url "http://localhost:$local_port" &
      ;;
    *)
      if [[ -n "$TUNNEL" ]]; then
        echo "Unknown tunnel tool '$TUNNEL'. Use 'ngrok' or 'cloudflared'." >&2
        exit 1
      fi
      ;;
  esac
}

if [[ "${MODE:-docker}" == "native" ]]; then
  echo "Starting chess-api natively on port $PORT ..."
  if [[ ! -d dist ]]; then
    echo "Building first ..."
    npm run build
  fi
  start_tunnel "$PORT"
  exec npm start
else
  echo "Starting chess-api in Docker on port $PORT -> 3000 ..."
  docker compose up --build -d
  start_tunnel "$PORT"
  echo "Server running at http://localhost:$PORT"
  echo "Stop with: docker compose down"
fi
