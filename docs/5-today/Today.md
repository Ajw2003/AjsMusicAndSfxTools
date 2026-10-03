# Today (tier 5): 2026-10-03

**Today was a planning and documentation day.** It maps to M0 (Foundation).

## Done

- Agreed the big choices with the owner (recorded in [Decisions](../6-decisions/Decisions.md)):
  web app with TypeScript + Vite + Svelte + Tone.js; hybrid sounds; all four export types; record/loop
  + piano roll + step sequencer; theme picker; the full accessibility set; both key layouts; MIT;
  Milestones with parent and sub-issues.
- Wrote all six doc tiers, `CLAUDE.md`, `LICENSE`, `CREDITS.md`.
- Created GitHub Milestones M0–M8, labels, 9 parent issues and 57 sub-issues (#1–#66).
- Built the empty app shell (#3), code checks (#4) and CI (#5). CI is green on GitHub.
- Fixed: lint, format and tests were also scanning agent worktree copies under `.claude/`; now excluded.

## Deliberately not done

- No instrument or audio code. That's M1, and it waits until the shell, checks and CI exist.
- No sample packs chosen. Licences must be read first (#17).

## Surfaced, not today's job

- Whether Node.js is installed on the owner's Windows PC.
- Which browser the owner mainly uses (matters for the latency measurement, #15).

## What to do next, in order

1. Owner runs the app once on their PC (commands in the landing page's Commands table) to tick off M0, then closes #1–#5.
2. M1 starts with "start the sound on first click" (#7) and the on-screen keyboard (#8). Every
   other M1 issue builds on those two.
3. #17 (sample sourcing) can run any time, in parallel, since it's research only.
