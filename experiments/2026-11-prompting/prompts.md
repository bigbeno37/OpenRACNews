# The prompt pieces

Every arm started with the base and limits below, plus the pieces listed for it. Each ran in its own checkout, on Sol at low effort, with other writers' reports deleted first.

| Arm | Pieces |
| --- | --- |
| A | Base |
| B | Base, Read everything |
| C | Base, Checklist |
| D | Base, Read everything, Checklist |
| E | Base, Read everything, Checklist, Review |
| F | Base, Brief, Checklist |
| G | Base, Brief, Checklist, Examples |
| H | Base, Brief, Checklist, Examples, Review |
| R1 | Base, Brief, Checklist, News, Examples, Review |
| R2 | Base, Read everything, Checklist, News, Examples, Review |
| P | The production prompt in `scripts/write-reports.sh`, with these rules in `AGENTS.md` |

## Base

> Write the missing reports for this site, following the "Writing reports" section of AGENTS.md. Start with config/tracking.json and AGENTS.md, then run: pnpm --silent reports:todo --date `<day>`
>
> Use "gpt-6.1-sol" as writtenBy. Finish by running: pnpm --silent reports:check

## Limits

> - Read files in this repository and write only under data/`<day>`/. Read-only shell commands such as cat, ls, grep and jq are fine for reading.
> - The only other commands you may run are `pnpm --silent reports:todo --date <day>`, `pnpm --silent reports:brief <path>` where the arm uses it, and `pnpm --silent reports:check`.
> - Don't use the network, the web, `gh` or GitHub. Everything you need is in the snapshot files.
> - Do the writing yourself, without starting subagents.
> - Don't commit, and leave your files where they are.

## Read everything

> Read all the source material before you write anything. Go through each snapshot separately and completely: every pull request with its body, and every landed commit with its body. Don't limit how much a command prints. If any output comes back truncated, read the rest before writing.

## Brief

> Read each snapshot with `pnpm --silent reports:brief <path to the snapshot>`, one at a time, for every file under data/`<day>`/branches/ and data/`<day>`/repos/. It prints everything you need in a compact form. Don't limit how much it prints, and read all of it before you write.

## Checklist

> Write for someone who follows this project but hasn't read the code:
> - Lead with what changed for players and contributors, and say what they can now do.
> - For any figure, say what it measures and which release or version it applies to. If a project has several releases with their own figures, give each one's.
> - Keep the warnings and limits the authors state: platforms not yet tested, features not yet playable, drafts not merged.
> - Be specific. Name released versions, affected levels and features, and issues closed or asking for help.
> - If something differs from what the branch's `about` would lead readers to expect, say so.
> - If a number looks odd, explain it, such as line counts dominated by one pull request.
> - Keep summaries within the limit: on a busy day, add highlights rather than sentences.

## News

> Write it as news. Readers have never seen your source material, so never mention the snapshot, the brief, the data or these instructions. When a figure needs a source, name it: the project's progress report, a pull request or its author.
>
> Keep to one idea per sentence, with no semicolon chains, in the overview especially. If the overview leans on matching, explain the word once.

## Examples

Two reports written by hand from other days: one release and one decompilation. On 31 October, the second example came from that same day, so it was rewritten without that day's figures. It still mentions the day's largest batch, a small leak affecting G and R1 equally. P's examples in `AGENTS.md` come from other days.

## Review

> When everything is written, go back through each report against its snapshot before running the check. For every figure, confirm what it measures and which release it applies to. Look through the pull requests again for anything readers would want that you left out, and for warnings you dropped. Fix what you find.
