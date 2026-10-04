# Today (tier 5): 2026-10-04, handoff (usability pass in progress)

**Read this first, then [ProjectState](../3-state/ProjectState.md) and [the arranger plan](../plans/arranger-timeline.md).**

## Where things are

- **Live site** (https://ajw2003.github.io/AjsMusicAndSfxTools/) = `main` = arranger phases A and B (PR #83,
  PR #85, both merged by the owner; CI green; deploys succeeded). Not opened in a browser by the agent: this
  environment's network policy blocks `github.io`.
- **Now building: the #84 usability pass** (dyslexia and ADHD), approved by the owner 2026-10-04, before
  phase C. Plan: `docs/plans/usability-pass.md`. Steps: #86 layout, #87 plain words, #88 reading settings,
  #89 focus aids, #90 axe scan + before/after screenshots. The owner has both dyslexia and ADHD and will
  try it.

## Next session, in order

1. Done on the branch: scrubbing (owner's request) and #86 calmer layout. Next: #87 plain words, then #88,
   #89; #90 runs throughout. Browser-check each step, with before/after
   screenshots in `docs/generated/usability/`.
2. One PR for the pass (or one per step if the owner prefers), then the owner tries it.
3. Then phase C: #79–#81 audio files, then D: #82 microphone.

## Open questions for the owner

- May the agent merge each arranger phase itself once CI and its own browser checks pass?
- Still open from earlier: themes beyond the four planned; default note names (C D E vs Do Re Mi).

## Not done / known gaps

- Nobody has measured key-to-sound latency (#15); needs the owner's PC.
- Sample-pack licences (#17) not researched; only chiptune sounds exist.
- Known rough edge: Pause during count-in can still play the pre-scheduled clicks (not re-checked).
- Touch dragging is checked with emulated touch only; no physical phone has tried it.

## Process notes for the next agent

- Commits end with `Committed by AJ's agent` (a house hook blocks Claude co-author trailers).
- A builder subagent once failed on a false-positive safety refusal; retrying on another model worked.
- Worktrees live under `.claude/worktrees/` (gitignored); lint/format/tests are scoped to skip them.
