#!/usr/bin/env bash
# Has an agent write whatever reports are missing, using GPT 6.1 Sol at low effort through the Codex CLI.
# Used by the daily workflow, and works the same locally: `CODEX_BIN=codex pnpm reports:write`. Set
# REPORT_DATE to write one day, and REPORT_ARGS to pass more options to Codex.
#
# The snapshots it reads contain text anyone can write, so the agent gets as little as the job allows.
# Its sandbox has no network and can only write inside this checkout, its commands don't inherit
# credentials, and it never sees a GitHub token. The workflow then checks its reports and commits only
# data/, so nothing else it wrote can reach the repository.
set -euo pipefail

model="${REPORT_MODEL:-gpt-6.1-sol}"
effort="${REPORT_EFFORT:-low}"
codex_bin="${CODEX_BIN:-pnpm dlx @openai/codex@0.166.0}"
todo="pnpm --silent reports:todo${REPORT_DATE:+ --date $REPORT_DATE}"

# shellcheck disable=SC2086 # todo is deliberately split into a command and its arguments.
if [[ "$($todo)" == "Nothing to write." ]]; then
  echo "Nothing to write."
  exit 0
fi

read -r -d '' prompt <<EOF || true
Write the missing reports for this site, following the "Writing reports" section of AGENTS.md. Start with config/tracking.json and AGENTS.md, then run: $todo

Use "$model" as writtenBy. Only write under data/, do the writing yourself, and don't commit. Finish by running: pnpm --silent reports:check
EOF

# shellcheck disable=SC2086 # codex_bin and REPORT_ARGS are deliberately split into separate arguments.
$codex_bin exec "$prompt" \
  --model "$model" \
  --config "model_reasoning_effort=\"$effort\"" \
  --config 'shell_environment_policy.inherit="core"' \
  --sandbox workspace-write \
  --ignore-user-config \
  --ephemeral \
  ${REPORT_ARGS:-}
