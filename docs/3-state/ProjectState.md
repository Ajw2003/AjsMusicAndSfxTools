# Project state (tier 3): where it stands right now

**As of 2026-10-03. Overall: 5% of 100% (M0 built; waiting on the owner's check).**

M0 is built: docs, issues, an empty app that builds, code checks and CI, which passed on GitHub on
commit 853fe43. The one acceptance step not yet checked is `npm run dev` on the owner's own PC.
Nothing from M1 onward exists.

| Milestone | Share | Status | Parent issue |
|---|---|---|---|
| M0: Foundation | 5% | Built; CI green; owner's local run not yet checked | #1 |
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
  9 GitHub Milestones, 9 parent issues, 57 sub-issues (#2).
- **Done:** app shell, Vite 8 + Svelte 5 + TypeScript 6 strict (#3); Prettier, ESLint, svelte-check,
  Vitest with one real test of `src/lib/note-names.ts` (#4); GitHub Actions CI in
  `.github/workflows/ci.yml` (#5). All five checks pass locally and in CI (run 37134666466).
- **Merged, not live:** PR #67 merged to `main` on 2026-10-03. The Pages deploy ran and failed
  ("Failed to create deployment (status: 404) ... Ensure GitHub Pages has been enabled", run
  37136626267) because Pages is not yet switched on in repo settings. The site returns 404 until the
  owner sets Settings → Pages → Source to GitHub Actions and the deploy is re-run.
- **Not checked:** `npm run dev` on the owner's Windows PC (Node.js may not be installed there).

## The one thing that is not what it looks like

The system docs in `docs/4-systems/` read like descriptions of working code. They aren't. They're
the agreed design, and no code exists for any of them yet. Each one says "Built? No" at the top.

## Cross-cutting issues that belong to no milestone

- **Sample licences.** Nothing about sample sources has been verified. Until #17 is done, any
  sample pack named in the docs is a candidate, not a choice.
- **Node.js on the owner's PC.** Not recorded whether it's installed. Building from source needs it.
- **Key-to-sound latency** has not been measured anywhere (#15).
