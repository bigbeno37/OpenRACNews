# OpenRAC News

Every [OpenRAC](https://github.com/OpenRAC) project as it stood on any day: the Ratchet & Clank decompilations, the launcher and the mods. Pick a date in the navbar and the whole site shows that day: how far each decompilation had got, what landed, and a written report per branch. Moving between days keeps you on the same project.

It's a static [Astro](https://astro.build) site for GitHub Pages, styled after [openrac.dev](https://openrac.dev).

## How it works

Once a day, just after midnight UTC, `.github/workflows/daily.yml`:

1. **Takes a snapshot.** `pnpm snapshot` records what landed on each branch in `config/tracking.json`, along with its pull requests, issues, releases and each decompilation's progress figures, under `data/<date>/`.
2. **Writes the reports.** An agent follows `AGENTS.md` to turn each snapshot into a report. `pnpm reports:check` then checks them, including that every pull request or issue they cite is really in the snapshot.
3. **Publishes.** It commits `data/` and deploys the site to GitHub Pages.

If the report step fails or isn't set up, the site still deploys, showing each branch's numbers, commits and pull requests without the written reports. The next run writes whatever is missing.

**What counts as a day:** 00:00 to 23:59 UTC. A commit counts on the day it landed on the branch, not the date written in the commit, because a pull request merged today often carries commits dated days earlier. This also means a finished day never changes.

## Choosing what's covered

Edit `config/tracking.json`. It's the only place that lists repositories and branches, and the snapshot script, the site and the agents all read it.

```json
{
  "name": "OpenRAC",
  "title": "OpenRAC launcher",
  "about": "What the repository is.",
  "branches": [
    { "name": "develop", "about": "What this branch is for. Agents use this to frame its reports." },
    { "name": "master", "about": "..." }
  ]
}
```

`lookbackDays` sets how many finished days each run revisits, which lets it catch up after a missed run.

## Setting up deployment

1. Push this repository to GitHub, with `main` as the default branch.
2. In **Settings > Pages**, set **Source** to **GitHub Actions**.
3. To get written reports, add a repository secret named `OPENAI_API_KEY` under **Settings > Secrets and variables > Actions**. Without it, the site runs without written reports.
4. Run the **Daily news** workflow from the **Actions** tab, or wait for the next scheduled run.

The site's address and base path come from GitHub Pages, so the repository name and any custom domain need no code changes.

Reports are written by GPT 6.1 Sol at low effort through the Codex CLI. Two optional repository variables change that: `REPORT_MODEL` (default `gpt-6.1-sol`) and `REPORT_EFFORT` (default `low`). Codex has no spending cap of its own, so set one in your OpenAI account. As a guide, one busy day took about 240,000 input tokens, most of them cached, and 2,200 output tokens. The experiments behind these choices are in `experiments/`.

## Local development

Requires Node 26 and pnpm.

```sh
pnpm install
pnpm dev                                # the site, at http://localhost:4321
pnpm snapshot --days 3                  # collect recent days (uses GH_TOKEN, or your gh login)
pnpm --silent reports:todo              # list the reports still to write
CODEX_BIN=codex pnpm reports:write      # have an agent write them
pnpm --silent reports:check             # validate the reports
pnpm test && pnpm check && pnpm build
```

## Credits

The design system, logo and section artwork come from [OpenRAC/openrac-site](https://github.com/OpenRAC/openrac-site) under the MIT licence: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an unofficial community project.
