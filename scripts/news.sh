#!/usr/bin/env bash
# One day's update, from collecting what happened to publishing it. Run it once a day, after 00:00 UTC, with
# `nix-shell --run 'pnpm news'`. It stops at the first failure, and running it again picks up where it left off.
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
pnpm install --frozen-lockfile
pnpm --silent snapshot
pnpm --silent reports:write
pnpm --silent reports:check
# Whatever breaks the build stops here, before it reaches the site.
pnpm build

git add data
if git diff --cached --quiet; then
  echo "Nothing new to publish."
  exit 0
fi
git commit -m "chore(data): news up to $(date -u -d yesterday +%F)"
git push
