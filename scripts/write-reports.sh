#!/usr/bin/env bash
# Has an agent write whatever reports are missing, using GPT 6.1 Sol at low effort through the Codex CLI.
# Used by the daily workflow, and works the same locally: `CODEX_BIN=codex pnpm reports:write`. Set
# REPORT_DATE to write one day, and REPORT_ARGS to pass more options to Codex.
#
# The snapshots it reads contain text anyone can write, so the agent gets as little as the job allows.
# Its sandbox has no network and can only write inside this checkout, not even to /tmp. Its commands
# don't inherit credentials, and it never sees a GitHub token. It can still read the disk, so its one way
# out is report text: the workflow checks that for credentials and commits only data/.
set -euo pipefail

model="${REPORT_MODEL:-gpt-6.1-sol}"
effort="${REPORT_EFFORT:-low}"
codex_bin="${CODEX_BIN:-pnpm dlx @openai/codex@0.166.0}"

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

  # shellcheck disable=SC2086 # codex_bin and REPORT_ARGS are deliberately split into separate arguments.
  $codex_bin exec "$prompt" \
    --model "$model" \
    --config "model_reasoning_effort=\"$effort\"" \
    --config 'shell_environment_policy.inherit="core"' \
    --config 'sandbox_workspace_write.exclude_slash_tmp=true' \
    --config 'sandbox_workspace_write.exclude_tmpdir_env_var=true' \
    --sandbox workspace-write \
    --ignore-user-config \
    --ephemeral \
    ${REPORT_ARGS:-} \
    </dev/null # Otherwise Codex waits on stdin for more of the prompt, and never starts.
done
