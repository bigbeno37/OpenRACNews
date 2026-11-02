#!/usr/bin/env bash
# Has an agent write whatever reports are missing. Used by the daily workflow, and works the same
# locally: `CLAUDE_BIN=claude pnpm reports:write`.
#
# The snapshots it reads contain text anyone can write, so the agent gets as little as the job allows:
# it can read the repository, write under data/, and run the two report commands. It has no general
# shell and no network tools, and it never sees a GitHub token.
set -euo pipefail

model="${REPORT_MODEL:-claude-opus-5-5}"
budget="${REPORT_BUDGET_USD:-5}"
claude_bin="${CLAUDE_BIN:-pnpm dlx @anthropic-ai/claude-code@2.1.316}"

# In GitHub Actions a secret that isn't set arrives as an empty string. An empty credential must not
# be mistaken for a real one, so only the one that was configured stays set.
[[ -n "${ANTHROPIC_API_KEY:-}" ]] || unset ANTHROPIC_API_KEY
[[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]] || unset CLAUDE_CODE_OAUTH_TOKEN

if [[ "$(pnpm --silent reports:todo)" == "Nothing to write." ]]; then
  echo "Nothing to write."
  exit 0
fi

read -r -d '' prompt <<EOF || true
Write the missing reports for this site, following the "Writing reports" section of AGENTS.md. Start with config/tracking.json and AGENTS.md, then run: pnpm --silent reports:todo

Use "$model" as writtenBy. Finish by running: pnpm --silent reports:check
EOF

# shellcheck disable=SC2086 # claude_bin is deliberately split into a command and its arguments.
$claude_bin -p "$prompt" \
  --model "$model" \
  --effort medium \
  --max-budget-usd "$budget" \
  --tools Read Write Edit Glob Grep Bash \
  --allowedTools Read Glob Grep 'Write(data/**)' 'Edit(data/**)' 'Bash(pnpm --silent reports:todo)' 'Bash(pnpm --silent reports:check)' \
  --permission-mode dontAsk \
  --setting-sources project \
  --strict-mcp-config \
  --no-session-persistence \
  --output-format "${REPORT_OUTPUT_FORMAT:-text}"
