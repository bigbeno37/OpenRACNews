# GPT 6.1 Sol (low effort) against Claude Opus 5.5 for writing reports

One experiment on one day, 1 November 2026: 6 branch reports and a day overview. The pipeline used Opus at the time. Each writer's reports are in [`sol/`](sol/) and [`opus/`](opus/). [The prompting experiments](../2026-11-prompting/README.md) came next.

## How it ran

Both writers got the same snapshots, the same prompt and the same limits. Each ran once.

|  | Opus 5.5 | Sol |
| --- | --- | --- |
| Effort | medium | low |
| Time | 2.5 minutes | 1.2 minutes |
| Usage | $1.48 | 240,338 input tokens (192,256 cached), 2,470 output. No dollar figure, since Sol's pricing wasn't checked |
| Automated checks | 7 of 7 passed | 7 of 7 passed |
| Length | 1,506 words, 86 citations | 826 words, 49 citations |

Two judges scored every item blind, with authorship removed and A/B labels shuffled per item: one Opus 5.5 and one Sol at high effort. Neither was told which models were involved.

## Scores

Average out of 5 across the 7 items.

| Judge | Writer | Accuracy | Usefulness | Clarity | Following the brief | Items won |
| --- | --- | --- | --- | --- | --- | --- |
| Opus judge | Opus | 4.86 | 4.86 | 4.00 | 4.14 | 7 |
| Opus judge | Sol | 4.43 | 2.71 | 3.43 | 4.14 | 0 |
| Sol judge | Opus | 4.86 | 4.71 | 4.00 | 3.86 | 5 |
| Sol judge | Sol | 4.71 | 4.00 | 4.71 | 4.71 | 2 |

Both judges preferred Opus on 5 items. They split on `rac1-decomp` and `rac4-decomp`, each of which the Sol judge gave to Sol. Each judge scored its own model's clarity and brief-following higher than the other judge did, so those columns may carry some family bias. Both agree on usefulness and accuracy.

## Problems confirmed against the snapshots

Neither writer made a flatly false claim. These were found by the judges and then checked by hand.

**Sol**

- Says Going Commando reached "7760 of 8579" without saying that's only USA v1.01. #386 gives different totals for the other releases, whose progress it omits. This is in its headline and overview.
- Says mod auto-updates arrived without #161's warning that they're "not yet run on Windows, macOS or Android".
- Cites #171 for shared headers replacing repeated declarations, but #171 only removes unused declarations.
- Says "display scaling" where #177 only scales the debug overlay.
- Doesn't name the three released mod versions in the mods report, or cite anything in its overview.

**Opus**

- Says "7249 hero states" where #190 replaced 7,249 uses of state numbers, not that many distinct states.
- Runs over the brief's limit of four sentences on 3 of 6 branch summaries.
- Misses that Vulkan became the default renderer in #188, which players would notice, and which Sol reports.
- Reads closer to a pull request list in places, such as the byte counts in the `rac4-decomp` report.

## Why Sol's reports are thinner

Sol's session log shows it capped its own reads, and two of its three reads came back truncated. It only asked for pull request descriptions on 3 of the 6 branches, not including `OpenRAC` `develop`, `rac2-decomp` or `rac4-decomp`. The testing caveat on #161 and the release table in #386 are both in those descriptions, so it may never have seen them. It deleted the other writer's files first and never touched git history, so the comparison stayed blind.

## Limits of this experiment

This is one day and one run each, at different effort settings, so it shows a direction rather than a settled result. It doesn't show how Sol does at higher effort, or with a prompt telling it to read every snapshot in full.
