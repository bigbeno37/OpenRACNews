# OpenRAC News

A daily digest of what's happening across the [OpenRAC](https://github.com/OpenRAC) projects: the Ratchet & Clank decompilations, the launcher and the mods. Each tracked branch gets its own report for every UTC day it was active, plus a summary of the whole day.

It's a static [Astro](https://astro.build) site for GitHub Pages, styled after [openrac.dev](https://openrac.dev).

## How it works

Once a day, just after midnight UTC, `.github/workflows/daily.yml`:

1. **Takes a snapshot.** `pnpm snapshot` records what landed on each branch in `config/tracking.json`, along with its pull requests, issues and releases, under `data/<date>/`.
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
3. To get written reports, add one repository secret under **Settings > Secrets and variables > Actions**: `ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token`. Without either, the site runs without written reports.
4. Run the **Daily news** workflow from the **Actions** tab, or wait for the next scheduled run.

The site's address and base path come from GitHub Pages, so the repository name and any custom domain need no code changes.

Two optional repository variables control the agent: `REPORT_MODEL` (default `claude-opus-5-5`) and `REPORT_BUDGET_USD`, its spending cap per run (default `5`). As a guide, writing the 7 files for one busy day (1 November 2026) cost $1.48 on the default model. If a run hits the cap, the next run picks up what's left.

## Local development

Requires Node 26 and pnpm.

```sh
pnpm install
pnpm dev                                # the site, at http://localhost:4321
pnpm snapshot --days 3                  # collect recent days (uses GH_TOKEN, or your gh login)
pnpm --silent reports:todo              # list the reports still to write
CLAUDE_BIN=claude pnpm reports:write    # have an agent write them
pnpm --silent reports:check             # validate the reports
pnpm test && pnpm check && pnpm build
```

## Credits

The design system, logo and section artwork come from [OpenRAC/openrac-site](https://github.com/OpenRAC/openrac-site) under the MIT licence: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an unofficial community project.
