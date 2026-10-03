# Project state (tier 3): where it stands right now

**As of 2026-10-03. Overall: about 2% of 100%.**

M0 (5%) is roughly half done: docs, licence, milestones and issues exist. No app code has
shipped yet. Nothing from M1 onward exists.

| Milestone | Share | Status | Parent issue |
|---|---|---|---|
| M0: Foundation | 5% | In progress: docs and issues done; app shell, checks and CI not yet | #1 |
| M1: Playable keyboard | 15% | Not started | #6 |
| M2: Instruments | 15% | Not started | #16 |
| M3: Customising sounds and keys | 10% | Not started | #28 |
| M4: Themes and accessibility | 10% | Not started | #34 |
| M5: Record and loop | 15% | Not started | #42 |
| M6: Save and export | 10% | Not started | #51 |
| M7: Piano roll and step sequencer | 15% | Not started | #57 |
| M8: Installable, offline and polished | 5% | Not started | #62 |

## M0: Foundation

- **Done:** six doc tiers, `CLAUDE.md`, `LICENSE` (MIT), `CREDITS.md` (empty, no samples yet),
  9 GitHub Milestones, 9 parent issues, 57 sub-issues (#2 docs).
- **Not done:** app shell (#3), code checks (#4), CI (#5).

## The one thing that is not what it looks like

The system docs in `docs/4-systems/` read like descriptions of working code. They aren't. They're
the agreed design, and no code exists for any of them yet. Each one says "Built? No" at the top.

## Cross-cutting issues that belong to no milestone

- **Sample licences.** Nothing about sample sources has been verified. Until #17 is done, any
  sample pack named in the docs is a candidate, not a choice.
- **Node.js on the owner's PC.** Not recorded whether it's installed. Building from source needs it.
- **Key-to-sound latency** has not been measured anywhere (#15).
