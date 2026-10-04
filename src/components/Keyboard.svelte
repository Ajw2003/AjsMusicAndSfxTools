<script lang="ts">
  import {
    KEY_LAYOUTS,
    getLayout,
    keyLabel,
    type LayoutId,
  } from "../lib/input/key-layouts";
  import {
    DEFAULT_OCTAVE,
    MAX_OCTAVE,
    MIN_OCTAVE,
    clampOctave,
    codeForMidi,
    midiForCode,
    octaveBaseMidi,
    pianoKeys,
  } from "../lib/input/piano-keys";
  import { isTyping } from "../lib/input/is-typing";
  import { drumLabel } from "../lib/audio/drums";
  import { midiToNoteName } from "../lib/note-names";
  import type { Snippet } from "svelte";

  interface Props {
    onNoteOn: (midi: number, velocity: number) => void;
    onNoteOff: (midi: number) => void;
    /** Glow colour for pressed keys (the active sound's colour). */
    colour: string;
    /** Show drum names (Kick/Snare/Hat) instead of note names. */
    drums?: boolean;
    /** Number of octaves drawn (phones use 1). */
    octaves?: number;
    octave?: number;
    /** Extra controls shown in the keyboard's top row (e.g. Hide keyboard). */
    controls?: Snippet;
  }
  let {
    onNoteOn,
    onNoteOff,
    colour,
    drums = false,
    octaves = 2,
    octave = $bindable(DEFAULT_OCTAVE),
    controls,
  }: Props = $props();

  const VELOCITY = 0.8;

  let layoutId = $state<LayoutId>("piano");

  const layout = $derived(getLayout(layoutId));
  const baseMidi = $derived(octaveBaseMidi(octave));
  const keys = $derived(pianoKeys(baseMidi, octaves));
  const whiteKeys = $derived(keys.filter((k) => !k.isBlack));
  const blackKeys = $derived(
    keys
      .filter((k) => k.isBlack)
      .map((k) => ({
        ...k,
        // Position: after the white key just below this black key.
        whiteBefore: whiteKeys.filter((w) => w.midi < k.midi).length,
      })),
  );

  // Every held note remembers its source ("p<pointerId>" or "k<code>"), so
  // fingers and computer keys can overlap without cutting each other off.
  let held = $state<Record<string, number>>({});
  const pressed = $derived(new Set(Object.values(held)));

  function press(source: string, midi: number): void {
    if (held[source] === midi) return;
    release(source);
    const alreadySounding = Object.values(held).includes(midi);
    held[source] = midi;
    if (!alreadySounding) onNoteOn(midi, VELOCITY);
  }

  function release(source: string): void {
    const midi = held[source];
    if (midi === undefined) return;
    delete held[source];
    if (!Object.values(held).includes(midi)) onNoteOff(midi);
  }

  function releaseAllHeld(): void {
    for (const source of Object.keys(held)) release(source);
  }

  function setOctave(next: number): void {
    releaseAllHeld(); // the held notes belong to the old octave
    octave = clampOctave(next);
  }

  // ---- Pointer (mouse, touch, pen) ----
  function midiAt(x: number, y: number): number | null {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-midi]");
    return el ? Number(el.dataset.midi) : null;
  }

  function onPointerDown(e: PointerEvent): void {
    const midi = midiAt(e.clientX, e.clientY);
    if (midi === null) return;
    e.preventDefault(); // no focus change, text selection or touch scrolling
    // Touch pointers are implicitly captured to the first key; let go so
    // sliding across keys is handled by pointermove + elementFromPoint.
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    press(`p${e.pointerId}`, midi);
  }

  function onPointerMove(e: PointerEvent): void {
    const source = `p${e.pointerId}`;
    if (!(source in held)) return;
    const midi = midiAt(e.clientX, e.clientY);
    if (midi === null) release(source);
    else press(source, midi);
  }

  function onPointerEnd(e: PointerEvent): void {
    release(`p${e.pointerId}`);
  }

  // ---- Computer keyboard ----
  // This is the keyboard-accessible way to play: the on-screen keys are
  // tabindex -1 so the page doesn't get 25 tab stops, and every note has a
  // computer key bound to it (shown on the key).
  function onWindowKeydown(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target))
      return;
    if (e.code === layout.octaveDownCode) {
      e.preventDefault();
      setOctave(octave - 1);
      return;
    }
    if (e.code === layout.octaveUpCode) {
      e.preventDefault();
      setOctave(octave + 1);
      return;
    }
    const midi = midiForCode(layout, baseMidi, e.code);
    if (midi === undefined) return;
    e.preventDefault();
    press(`k${e.code}`, midi);
  }

  function onWindowKeyup(e: KeyboardEvent): void {
    release(`k${e.code}`);
  }

  function onVisibilityChange(): void {
    if (document.visibilityState === "hidden") releaseAllHeld();
  }

  function boundLabel(midi: number): string {
    const code = codeForMidi(layout, baseMidi, midi);
    return code ? keyLabel(code) : "";
  }

  function labelFor(midi: number): string {
    const bound = boundLabel(midi);
    const name = drums
      ? `${drumLabel(midi)} (${midiToNoteName(midi)})`
      : midiToNoteName(midi);
    return bound ? `${name}, key ${bound}` : name;
  }

  /**
   * Drum keys are named once per run of keys with the same drum ("Kick"
   * over the first kick key, and so on), so the word never has to squeeze
   * into one narrow key. Every key still has its full aria-label.
   */
  function startsDrumRun(midi: number): boolean {
    const whiteIndex = whiteKeys.findIndex((k) => k.midi === midi);
    if (whiteIndex <= 0) return true;
    return drumLabel(whiteKeys[whiteIndex - 1].midi) !== drumLabel(midi);
  }

  /** Note name; the octave number is only shown on C to save space. */
  function shortName(midi: number): string {
    if (drums) return startsDrumRun(midi) ? drumLabel(midi) : "";
    const name = midiToNoteName(midi);
    return name.startsWith("C") && !name.startsWith("C#")
      ? name
      : name.replace(/-?\d+$/, "");
  }
</script>

<svelte:window
  onkeydown={onWindowKeydown}
  onkeyup={onWindowKeyup}
  onblur={releaseAllHeld}
  onpointerup={onPointerEnd}
  onpointercancel={onPointerEnd}
/>
<svelte:document onvisibilitychange={onVisibilityChange} />

<section
  class="keyboard"
  class:drums
  aria-label="Keyboard"
  style:--glow={colour}
  style:--black-w="calc(100% / {whiteKeys.length} * 0.62)"
>
  <div class="controls">
    {@render controls?.()}
    <label>
      Computer keys
      <select
        value={layoutId}
        onchange={(e) => {
          layoutId = e.currentTarget.value as LayoutId;
          // Give focus back so computer keys play right away.
          e.currentTarget.blur();
        }}
      >
        {#each KEY_LAYOUTS as l (l.id)}
          <option value={l.id}>{l.name}</option>
        {/each}
      </select>
    </label>
    <div class="octave" role="group" aria-label="Octave">
      <button
        type="button"
        aria-label="Octave down ({keyLabel(layout.octaveDownCode)})"
        disabled={octave <= MIN_OCTAVE}
        onclick={() => setOctave(octave - 1)}>-</button
      >
      <output aria-live="polite">Octave {octave}</output>
      <button
        type="button"
        aria-label="Octave up ({keyLabel(layout.octaveUpCode)})"
        disabled={octave >= MAX_OCTAVE}
        onclick={() => setOctave(octave + 1)}>+</button
      >
    </div>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="piano"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <div class="whites">
      {#each whiteKeys as key, i (key.midi)}
        <button
          type="button"
          class="key white"
          class:last={i === whiteKeys.length - 1}
          class:pressed={pressed.has(key.midi)}
          data-midi={key.midi}
          tabindex="-1"
          aria-label={labelFor(key.midi)}
          aria-pressed={pressed.has(key.midi)}
        >
          <span class="note">{shortName(key.midi)}</span>
          <span class="bound">{boundLabel(key.midi)}</span>
        </button>
      {/each}
    </div>
    {#each blackKeys as key (key.midi)}
      <button
        type="button"
        class="key black"
        class:pressed={pressed.has(key.midi)}
        data-midi={key.midi}
        tabindex="-1"
        aria-label={labelFor(key.midi)}
        aria-pressed={pressed.has(key.midi)}
        style:left="calc({key.whiteBefore} * 100% / {whiteKeys.length} - var(--black-w)
        / 2)"
      >
        {#if !drums}<span class="note">{shortName(key.midi)}</span>{/if}
        <span class="bound">{boundLabel(key.midi)}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .keyboard {
    width: 100%;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1.5rem;
    margin-bottom: 0.75rem;
  }
  select,
  .octave button {
    font: inherit;
    min-height: 2.75rem;
    padding: 0.25rem 0.75rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  .octave button {
    min-width: 2.75rem;
    cursor: pointer;
  }
  .octave button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .octave {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .piano {
    position: relative;
    height: clamp(9rem, 38vw, 14rem);
    /* The browser must not scroll or zoom while fingers play. */
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }
  .whites {
    display: flex;
    height: 100%;
    gap: 1px;
  }
  .key {
    font: inherit;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: 0.25rem 0;
    border: 1px solid var(--color-border);
    cursor: pointer;
    touch-action: none;
    -webkit-tap-highlight-color: transparent;
  }
  .white {
    flex: 1 1 0;
    min-width: 0;
    color: var(--color-white-key-text);
    background: var(--color-white-key);
    border-radius: 0 0 0.4rem 0.4rem;
  }
  .black {
    position: absolute;
    top: 0;
    width: var(--black-w);
    height: 60%;
    z-index: 1;
    color: var(--color-black-key-text);
    background: var(--color-black-key);
    border-radius: 0 0 0.3rem 0.3rem;
  }
  /* Labels follow the Reading text size, but never grow wider than a key:
     5cqi of the piano's width caps them on narrow screens, and 14px is the
     floor. Words are never broken across lines. */
  .piano {
    container-type: inline-size;
  }
  .note,
  .bound {
    white-space: nowrap;
    line-height: 1.2;
    letter-spacing: normal;
    word-spacing: normal;
  }
  .note {
    font-size: clamp(14px, 0.95rem, 5cqi);
    font-weight: 600;
  }
  .bound {
    font-size: clamp(14px, 0.875rem, 4.5cqi);
    opacity: 0.75;
    min-height: 1.2em;
  }
  /* A drum name sits over the first key of its run and may spread over the
     keys that follow (they play the same drum). */
  .black .note {
    font-size: clamp(14px, 0.95rem, 4cqi);
  }
  .drums .white {
    align-items: flex-start;
    position: relative;
  }
  .drums .white .note {
    position: absolute;
    left: 0.35rem;
    bottom: 1.6em;
    z-index: 2;
    pointer-events: none;
  }
  /* The last key has no keys after it to spread over. */
  .drums .white.last .note {
    left: auto;
    right: 0.35rem;
  }
  .drums .white .bound {
    align-self: center;
  }
  .key.pressed {
    background: var(--glow);
    color: #111;
    box-shadow: 0 0 1rem var(--glow);
  }
  @media (max-width: 600px) {
    .piano {
      /* In px, so a larger Reading text size can't push the timeline off
         a phone screen. */
      height: clamp(120px, 22svh, 152px);
    }
    /* Computer-key letters mean nothing on a touch screen. */
    .bound {
      display: none;
    }
    .drums .white .note {
      bottom: 0.4rem;
    }
    .white {
      /* 8 keys must fit a 360px screen (about 41px each). */
      min-width: 0;
    }
    /* Touch screens don't need the computer-key layout picker. */
    .controls label {
      display: none;
    }
    .controls {
      margin-bottom: 0.5rem;
      gap: 0.5rem 1rem;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .key {
      transition:
        background-color 0.08s,
        box-shadow 0.12s;
    }
  }
</style>
