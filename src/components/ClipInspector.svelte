<script lang="ts">
  import type { Clip } from "../lib/song/song";

  type ClipChanges = Partial<Omit<Clip, "id" | "content">>;

  interface Props {
    clip: Clip;
    /** Colour the clip shows when it has none of its own. */
    trackColour: string;
    beatsPerBar: number;
    /** True when the playhead is strictly inside the clip. */
    canSplit: boolean;
    canPaste: boolean;
    onChange: (changes: ClipChanges) => void;
    onSplit: () => void;
    onDuplicate: () => void;
    onCopy: () => void;
    onPaste: () => void;
    onDelete: () => void;
  }
  let {
    clip,
    trackColour,
    beatsPerBar,
    canSplit,
    canPaste,
    onChange,
    onSplit,
    onDuplicate,
    onCopy,
    onPaste,
    onDelete,
  }: Props = $props();

  const startBar = $derived(Math.floor(clip.startBeat / beatsPerBar) + 1);
  const startBeatInBar = $derived(
    Math.round(((clip.startBeat % beatsPerBar) + 1) * 100) / 100,
  );
  const isNotes = $derived(clip.content.kind === "notes");

  /**
   * Commit a typed number. An empty or invalid entry snaps the field back
   * to the clip's value instead of changing anything.
   */
  function commitNumber(
    e: Event & { currentTarget: HTMLInputElement },
    apply: (value: number) => ClipChanges,
    shown: () => number,
  ): void {
    // currentTarget is gone once the event is over, so keep the element.
    const input = e.currentTarget;
    const value = Number(input.value);
    if (input.value !== "" && Number.isFinite(value)) onChange(apply(value));
    // Show the value the clip actually has after clamping.
    queueMicrotask(() => {
      input.value = String(shown());
    });
  }

  function commitName(e: Event & { currentTarget: HTMLInputElement }): void {
    const name = e.currentTarget.value.trim();
    if (name === "") e.currentTarget.value = clip.name;
    else if (name !== clip.name) onChange({ name });
  }
</script>

<section class="inspector" aria-label="Clip {clip.name}">
  <h2>Clip</h2>
  <div class="fields">
    <label>
      Name
      <input
        class="text"
        type="text"
        maxlength="40"
        value={clip.name}
        onchange={commitName}
      />
    </label>
    <label>
      Start bar
      <input
        type="number"
        min="1"
        step="1"
        value={startBar}
        onchange={(e) =>
          commitNumber(
            e,
            (v) => ({
              startBeat:
                (Math.max(1, Math.round(v)) - 1) * beatsPerBar +
                (startBeatInBar - 1),
            }),
            () => startBar,
          )}
      />
    </label>
    <label>
      Beat
      <input
        type="number"
        min="1"
        max={beatsPerBar + 0.75}
        step="0.25"
        value={startBeatInBar}
        onchange={(e) =>
          commitNumber(
            e,
            (v) => ({
              startBeat:
                (startBar - 1) * beatsPerBar +
                Math.min(beatsPerBar + 0.75, Math.max(1, v)) -
                1,
            }),
            () => startBeatInBar,
          )}
      />
    </label>
    <label>
      Length (beats)
      <input
        type="number"
        min="0.25"
        step="0.25"
        value={clip.lengthBeats}
        onchange={(e) =>
          commitNumber(
            e,
            (v) => ({ lengthBeats: v }),
            () => clip.lengthBeats,
          )}
      />
    </label>
    <label>
      Loop length (beats)
      <input
        type="number"
        min="0.25"
        step="0.25"
        value={clip.loopBeats}
        aria-describedby="loop-hint"
        onchange={(e) =>
          commitNumber(
            e,
            (v) => ({ loopBeats: v }),
            () => clip.loopBeats,
          )}
      />
    </label>
    {#if isNotes}
      <label>
        Transpose (semitones)
        <input
          type="number"
          min="-24"
          max="24"
          step="1"
          value={clip.transpose}
          onchange={(e) =>
            commitNumber(
              e,
              (v) => ({ transpose: Math.round(v) }),
              () => clip.transpose,
            )}
        />
      </label>
    {/if}
    <label>
      Volume (dB)
      <input
        type="number"
        min="-30"
        max="6"
        step="1"
        value={clip.gainDb}
        onchange={(e) =>
          commitNumber(
            e,
            (v) => ({ gainDb: v }),
            () => clip.gainDb,
          )}
      />
    </label>
    <span class="colour">
      <label>
        Colour
        <input
          type="color"
          value={clip.colour ?? trackColour}
          onchange={(e) => onChange({ colour: e.currentTarget.value })}
        />
      </label>
      <button
        type="button"
        disabled={clip.colour === null}
        onclick={() => onChange({ colour: null })}
      >
        Use track colour
      </button>
    </span>
  </div>
  <p id="loop-hint" class="hint">
    4 beats = 1 bar. A shorter loop than the length repeats the content;
    shortening the loop drops the notes past its end (Undo brings them back).
  </p>
  <div class="actions">
    <button
      type="button"
      disabled={!canSplit}
      aria-keyshortcuts="Control+E"
      onclick={onSplit}>Split at playhead</button
    >
    <button type="button" aria-keyshortcuts="Control+D" onclick={onDuplicate}
      >Duplicate</button
    >
    <button type="button" aria-keyshortcuts="Control+C" onclick={onCopy}
      >Copy</button
    >
    <button
      type="button"
      disabled={!canPaste}
      aria-keyshortcuts="Control+V"
      onclick={onPaste}>Paste at playhead</button
    >
    <button type="button" aria-keyshortcuts="Delete" onclick={onDelete}
      >Delete clip</button
    >
  </div>
  <p class="hint">
    Shortcuts: Ctrl+E split, Ctrl+D duplicate, Ctrl+C copy, Ctrl+V paste, Delete
    removes. On a focused clip: arrows move it, Shift+arrows change its end,
    Alt+arrows its start, Up/Down change track.
  </p>
</section>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  h2 {
    margin: 0;
    font-size: 1rem;
  }
  .fields,
  .actions,
  .colour {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  input,
  button {
    font: inherit;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.25rem 0.6rem;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  input[type="number"] {
    width: 5.5rem;
  }
  input[type="color"] {
    width: 3.5rem;
    padding: 0.2rem;
  }
  .text {
    width: 12rem;
    max-width: 100%;
  }
  button {
    cursor: pointer;
    min-width: 2.75rem;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .hint {
    margin: 0;
    color: var(--color-muted);
    font-size: 0.85rem;
  }
</style>
