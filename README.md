# OpenRAC News

Every [OpenRAC](https://github.com/OpenRAC) project as it stood on any reported day: the Ratchet & Clank decompilations, the launcher and the mods. Pick a date in the navbar and the whole site shows that day: how far each decompilation had got, what landed, and a written report per branch. Moving between days keeps you on the same project.

It's a static [Astro](https://astro.build) site, styled after [openrac.dev](https://openrac.dev). You run one command a day on your own machine to collect the news and write the reports, and GitHub Actions builds and publishes the result to GitHub Pages.

## How it works

`pnpm news` runs these steps:

1. **Takes a snapshot.** `pnpm snapshot` records what landed on each branch in `config/tracking.json`, along with its pull requests, issues, releases and each decompilation's progress figures, under `data/<date>/`.
2. **Writes the reports.** An agent follows `AGENTS.md` to turn each snapshot into a report. `pnpm reports:check` then checks them, including that every pull request or issue they cite is really in the snapshot.
3. **Publishes.** It builds the site to catch anything broken, then commits `data/` and pushes. The push starts `.github/workflows/deploy.yml`, which builds the site and deploys it to GitHub Pages.

**What counts as a day:** 00:00 to 23:59 UTC. A commit counts on the day it landed on the branch, not the date written in the commit, because a pull request merged today often carries commits dated days earlier. This also means a finished day never changes.

**Which days appear:** only days with a written report. Other days stay in `data/`, because reports and project pages look back at them for earlier figures, but they get no page.

## Running it on NixOS

`shell.nix` provides Node 26, pnpm, the GitHub CLI, git and Codex, all pinned to one nixpkgs revision. You don't need flakes, a particular channel or any change to your system configuration.

### First-time setup

```sh
nix-shell -p git --run "git clone <this repository's URL> OpenRACNews"
cd OpenRACNews
nix-shell                          # the first run downloads everything, which takes a few minutes

gh auth login                      # snapshots read GitHub's API
gh auth setup-git                  # lets `git push` use that login
git config user.name "Your Name"
git config user.email "you@example.com"

codex login --device-auth          # for a machine with no browser
```

To use an API key instead of a ChatGPT login, run `printenv OPENAI_API_KEY | codex login --with-api-key`.

On a machine with no Nix channel, `nix-shell` prints an error about `<nixpkgs>` and then carries on. It's harmless: it's only looking for a nicer bash.

### The daily update

Run this once a day, any time after 00:00 UTC:

```sh
cd OpenRACNews
nix-shell --run 'pnpm news'
```

It stops at the first failure and commits nothing, and running it again picks up where it left off. A day it has finished is left alone, so running it twice is harmless.

Each run covers the last three finished days (`lookbackDays` in `config/tracking.json`), so missing a day or two needs nothing special. To catch up after a longer gap, collect those days, then write each one:

```sh
nix-shell --run 'pnpm snapshot --days 7'
nix-shell --run 'REPORT_DATE=2026-11-05 pnpm reports:write'
```

Then run `pnpm news` as usual to publish them.

### What the agent can reach

Reports are written from text anyone with a GitHub account can write, so treat what the agent reads as hostile. `scripts/write-reports.sh` limits its commands to no network and writing only under `data/`. They can read this repository, the Nix store and basic system files, but not your home directory, `.git` or `/etc/nixos`, so they can't see your GitHub or Codex logins or SSH keys. They can still read the rest of `/etc`, so don't keep secrets in world-readable files there. Run it inside `nix-shell`, since the sandbox relies on Node and pnpm coming from the Nix store.

Codex has no spending cap of its own, so set one in your OpenAI account. As a guide, one busy day (1 November 2026) took about 614,000 input tokens, of which 48,000 weren't cached, and 5,800 output tokens. `REPORT_MODEL` and `REPORT_EFFORT` change the model and effort, which default to `gpt-6.1-sol` and `low`. The experiments behind those defaults are in `experiments/`.

## Publishing to GitHub Pages

1. Push this repository to GitHub, with `main` as the default branch.
2. In **Settings > Pages**, set **Source** to **GitHub Actions**.
3. Run the **Deploy site** workflow from the **Actions** tab, or push to `main`.

The site's address and base path come from GitHub Pages, so the repository name and any custom domain need no code changes. The workflow needs no secrets.

## Serving it from your own machine instead

The build is plain static files in `dist/`, so any web server can serve it. On NixOS, add this to your configuration:

```nix
services.nginx = {
  enable = true;
  virtualHosts."news.example.com" = {
    root = "/var/www/openrac-news";
    extraConfig = "error_page 404 /404.html;";
  };
};
systemd.tmpfiles.rules = [ "d /var/www/openrac-news 0755 YOUR_USER users -" ];
networking.firewall.allowedTCPPorts = [ 80 ];
```

Keep the files outside your home directory, because NixOS's nginx service can't read inside it. Then add the site's address and a copy to the daily update:

```sh
nix-shell --run 'SITE_URL=http://news.example.com pnpm news && cp -rT dist /var/www/openrac-news'
```

`SITE_URL` gives each page its full address. If you serve the site under a sub-path, set `BASE_PATH` as well.

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

## Development

Inside `nix-shell`, or anywhere with Node 26 and pnpm:

```sh
pnpm install
pnpm dev                     # the site, at http://localhost:4321
pnpm --silent reports:todo   # list the reports still to write
pnpm --silent reports:check  # validate the reports
pnpm test && pnpm check && pnpm build
```

## Credits

The design system, logo and section artwork come from [OpenRAC/openrac-site](https://github.com/OpenRAC/openrac-site) under the MIT licence: see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This is an unofficial community project.
