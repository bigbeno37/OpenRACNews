# What prompting gets the best reports from GPT 6.1 Sol at low effort

Three rounds on three different days, November 2026. Effort stayed on low for every writer. The winning setup is what the pipeline now uses: its rules are in [`AGENTS.md`](../../AGENTS.md) and the command is in [`scripts/write-reports.sh`](../../scripts/write-reports.sh). The prompts are in [`prompts.md`](prompts.md), and the reports are in [`outputs/`](outputs/).

## Result

**What helped, roughly in order:**

1. **Telling it what readers care about.** A checklist took coverage of what matters from 50% to 78%, more than anything else.
2. **Reading a compact brief instead of raw JSON.** It beat "read everything" on fresh days and used about half the tokens. Reading raw JSON looked good on the tuning day and came last on the next one.
3. **Fixing faults judges named,** such as "the snapshot" appearing in reader-facing text, chains of semicolons and figures with no release named. Rules removed the first two completely. The third needed a data fix: `progressRelease` in the config.
4. **Two worked examples, and a review pass before finishing.** Both helped a little. Review barely moved coverage, but ranked better with both judges.

**What didn't help:** telling it to read everything without saying what to look for. That tripled input tokens for a small gain.

## Round 1: tuning, 1 November

Each arm adds one idea. Coverage is a checklist of 46 facts a good report should include, written before these prompts ran. It only measures what's mentioned, not whether it's right or readable. Its one correction: it first missed "automatic updates" when looking for "auto-update", which affected every arm equally.

| Arm | Prompt | Coverage | Words | Input tokens | Uncached |
| --- | --- | --- | --- | --- | --- |
| A | Baseline | 50% | 728 | 239,650 | 34,338 |
| B | Read everything | 61% | 854 | 750,940 | 79,068 |
| C | Reader checklist | 78% | 1,148 | 254,330 | 50,298 |
| D | B + C | 87% | 1,096 | 608,008 | 121,352 |
| E | D + review | 85% | 1,139 | 760,574 | 83,582 |
| F | Brief + C | 80% | 1,102 | 336,043 | 44,587 |
| G | F + examples | 85% | 1,033 | 350,436 | 49,508 |
| H | G + review | 83% | 1,074 | 314,577 | 42,961 |
| Opus 5.5 | Reference, medium effort | 93% | 1,506 | | |

Two blind judges then scored the finalists, with authorship removed and labels shuffled per item. Lower average rank is better.

| Writer | Opus judge | Sol judge |
| --- | --- | --- |
| Opus 5.5 | 1.43 | 3.86 |
| E | 2.86 | 1.43 |
| D | 3.00 | 2.14 |
| G | 3.43 | 3.43 |
| A | 4.29 | 4.14 |

Both judges put the Sol prompts in the same order, but they split on Opus, so this doesn't settle whether Sol has caught up with it. G's position is also understated. Both judges marked down its "up from 66.51%" as unsupported, and the Opus judge called it serious. The figure is correct: it came from the brief's previous-day line, which the judges hadn't been given.

## Round 2: held out, 29 October

R1 and R2 are the refined prompts, adding the judges' fixes to G with a review pass. They differ only in how they read the data. Prompts A, D and G ran before `progressRelease` existed, so part of R1 and R2's gain comes from that data fix.

| Arm | Prompt | Opus judge | Sol judge | Combined | Words | Leaks | Semicolons | Uncached |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G | Brief, checklist, examples | 2.13 | 2.13 | **2.13** | 983 | 1 | 17 | 31,945 |
| R1 | Refined, brief | 2.88 | 2.38 | 2.63 | 924 | 0 | 0 | 46,873 |
| R2 | Refined, read everything | 2.50 | 3.75 | 3.13 | 1,099 | 0 | 0 | 72,245 |
| A | Baseline | 3.63 | 3.25 | 3.44 | 719 | 1 | 3 | 58,117 |
| D | Read everything, checklist | 3.88 | 3.50 | 3.69 | 1,061 | 2 | 18 | 83,453 |

This overturned round 1: D fell from second among the Sol prompts to last, behind the baseline. Both brief-based prompts came out ahead of it. G and R1 were close: G ranked better on average, while R1 took more first places and scored higher on accuracy and clarity.

## Round 3: final, 31 October

P is the production setup: the winning rules moved into `AGENTS.md`, plus the judges' remaining fixes, run through the real `codex exec` command. The prompt it receives is only a few sentences. This also tested the pipeline itself, and found that `codex exec` waits forever on stdin unless it's closed.

| Arm | Prompt | Opus judge | Sol judge | First places | Usefulness | Words | Input tokens | Uncached |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P | Production | **1.67** | **1.50** | 6 of 12 | 4.50, 4.83 | 866 | 295,741 | 49,725 |
| G | Brief, checklist, examples | 2.17 | 2.17 | 3 of 12 | 4.17, 4.50 | 909 | 174,246 | 52,774 |
| R1 | Refined, brief | 2.17 | 2.33 | 3 of 12 | 4.17, 4.50 | 924 | 139,520 | 21,120 |
| A | Baseline | 4.00 | 4.00 | 0 of 12 | 2.50, 2.83 | 663 | 164,291 | 32,451 |

Both judges agree on the order at the top and the bottom, and baseline came last on every item for both. Almost nothing was wrong factually across all four. What separated them was what they chose to include and how plainly they said it.

## Limits

- **Small sample.** Each prompt ran once per day. The differences between G, R1 and P are small enough that a rerun could reorder them. Baseline against the rest is not close.
- **Opus wasn't in rounds 2 and 3,** so this doesn't show whether the final prompt matches Opus. In round 1, before the later improvements, the judges disagreed about that.
- **The checklist favours length,** and I wrote it after reading the Opus reports, which is why blind judges made the decisions.
- **The judges were two models, one from each family, not readers.** They do favour their own family's style to some degree, as round 1 shows.
- **Token costs vary by run,** and P's input was higher than the other arms' on round 3. They haven't been priced.
- **The final tweak wasn't judged:** requiring "matching" to be explained wherever a match figure appears came after round 3.
