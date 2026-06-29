#!/bin/sh
set -e

# Ensure mounted volumes are writable by the chess user
chown -R chess:chess /app/data /app/logs /app/backups

# Drop privileges and run the app (su-exec execs directly, so node gets PID 1
# and receives signals like SIGTERM for graceful shutdown)
exec su-exec chess node dist/index.js
