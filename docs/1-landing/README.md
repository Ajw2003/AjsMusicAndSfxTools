# AJ's Music & SFX Tools: start here

A browser keyboard you can play with your computer keyboard, mouse or touch. You pick from eight
instruments (piano, acoustic guitar, electric guitar, bass, drums, chiptune, stylophone, theremin)
or your own sounds, rebind any key, then record, loop, edit and export songs and sound effects.
It's built to be calm, ADHD-friendly and accessible to anyone, with themes, a Simple mode, note
labels and full keyboard and screen reader support.

Personal project, MIT licensed. Built as a web app (TypeScript, Vite, Svelte, Tone.js).

## Moving parts

| Part | One line | Where |
|---|---|---|
| App shell | Vite + Svelte + TypeScript app (empty page so far) | `src/`, `index.html`, `package.json`, `vite.config.ts` |
| Checks | Prettier, ESLint, svelte-check, Vitest; run in CI on every push | `package.json` scripts, `eslint.config.js`, `.github/workflows/ci.yml` |
| Docs | These six tiers | `docs/` |
| Issues | One GitHub Milestone per roadmap stage, parent + sub-issues | GitHub Issues / Milestones |
| Credits | Licence and author of every third-party sample | `CREDITS.md` |

## The documentation tiers

| Tier | File | Answers |
|---|---|---|
| 1 | [docs/1-landing/README.md](README.md) | What is this, where is everything (this page) |
| 2 | [docs/2-roadmap/Roadmap.md](../2-roadmap/Roadmap.md) | What "done" means, milestone by milestone |
| 3 | [docs/3-state/ProjectState.md](../3-state/ProjectState.md) | Where it stands right now |
| 4 | [docs/4-systems/](../4-systems/README.md) | How each core system works |
| 5 | [docs/5-today/Today.md](../5-today/Today.md) | What's being worked on today |
| 6 | [docs/6-decisions/Decisions.md](../6-decisions/Decisions.md) | Why things were decided |

## Systems

All designed, none built yet (see [the systems index](../4-systems/README.md)).

| System | Owns |
|---|---|
| [Audio engine](../4-systems/audio-engine.md) | Making sound, the clock, the master output |
| [Instruments](../4-systems/instruments.md) | The 8 instruments, sample loading, custom samples |
| [Input mapping](../4-systems/input-mapping.md) | Keys, mouse, touch → notes; rebinding; layout presets |
| [Song timeline](../4-systems/song-timeline.md) | The song data shared by recording, loops, piano roll, step sequencer |
| [Persistence and export](../4-systems/persistence-and-export.md) | Settings, autosave, project files, WAV/MP3/OGG/MIDI |

## Commands

| Command | Does |
|---|---|
| `npm ci` | Install exact dependency versions from the lockfile |
| `npm run dev` | Start the app at http://localhost:5173 |
| `npm run format` / `format:check` | Format with Prettier / check formatting |
| `npm run lint` | ESLint |
| `npm run check` | Type check (svelte-check + tsc) |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run build` | Production build into `dist/` |

## Everything else

- [docs/example-environment.md](../example-environment.md): the owner's machine (Windows, PowerShell)
- `docs/plans/`: plans for specific work, live until done
- `docs/archive/`: inert docs (empty so far)
- `docs/generated/`: tool-made reports (empty so far)

## Conventions

- **Accessibility is a rule for every change, from M1 on:** every control works with the keyboard
  alone, has a visible focus outline and a proper label; colour is never the only way something
  is shown; animations respect the reduced-motion setting.
- **Calm by default:** Simple mode shows only what's needed to play. New controls go in Advanced
  unless they're needed to play.
- **Free first:** open-source libraries and freely licensed samples. Every sample is credited in
  `CREDITS.md`. Ask before adding any dependency.
- **Code style:** TypeScript strict, Prettier, ESLint; `kebab-case.ts` modules, `PascalCase.svelte`
  components, named exports. The house coding standards apply.
- **Commits:** `<type>: <summary>` (feat, fix, refactor, chore, docs, test), one change per commit.
- **Issues:** pull requests say `Refs #N`, never `Closes #N`. The owner closes issues after testing.
- **Docs:** update the tier that changed. Cite code as `file:line`. Decisions are appended, never rewritten.
