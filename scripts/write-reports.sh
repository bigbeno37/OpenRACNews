#!/usr/bin/env bash
# Has an agent write whatever reports are missing, using GPT 6.1 Sol at low effort through the Codex CLI.
# `pnpm news` runs this, inside nix-shell. Set REPORT_DATE to write one day, and REPORT_ARGS to pass more
# options to Codex.
#
# The snapshots it reads contain text anyone can write, and it runs on a machine holding real credentials,
# so the agent's commands get as little as the job allows: no network, and only the core environment
# variables. They can read this repository, the Nix store and basic system files, but not the home directory
# or .git, so they can't see a GitHub or Codex login or an SSH key. They can only write under data/. That also
# keeps them from changing a script or a git hook, which would run outside the sandbox once they finish. This
# relies on Node and pnpm coming from the Nix store, as they do in nix-shell.
set -euo pipefail

model="${REPORT_MODEL:-gpt-6.1-sol}"
effort="${REPORT_EFFORT:-low}"
permissions='{news={filesystem={":minimal"="read","/nix/store"="read","/etc/nixos"="deny",":workspace_roots"={"."="read","data"="write",".git"="deny"}},network={enabled=false}}}'

# One day per run, oldest first. After missed runs there can be several, and low effort reads less
# carefully when it's given more at once.
if [[ -n "${REPORT_DATE:-}" ]]; then
  days="$REPORT_DATE"
else
  days="$(pnpm --silent reports:todo | grep -oE 'data/[0-9]{4}-[0-9]{2}-[0-9]{2}' | cut -d/ -f2 | sort -u)"
fi

if [[ -z "$days" ]]; then
  echo "Nothing to write."
  exit 0
fi

for day in $days; do
  echo "Writing reports for $day"
  read -r -d '' prompt <<EOF || true
Write the missing reports for this site, following the "Writing reports" section of AGENTS.md. Start with config/tracking.json and AGENTS.md, then run: pnpm --silent reports:todo --date $day

Use "$model" as writtenBy. Only write under data/$day/, do the writing yourself, and don't commit. Finish by running: pnpm --silent reports:check
EOF

  # shellcheck disable=SC2086 # REPORT_ARGS is deliberately split into separate arguments.
  codex exec "$prompt" \
    --model "$model" \
    --config "model_reasoning_effort=\"$effort\"" \
    --config "permissions=$permissions" \
    --config 'default_permissions="news"' \
    --config 'shell_environment_policy.inherit="core"' \
    --ignore-user-config \
    --ephemeral \
    ${REPORT_ARGS:-} \
    </dev/null # Otherwise Codex waits on stdin for more of the prompt, and never starts.
done
