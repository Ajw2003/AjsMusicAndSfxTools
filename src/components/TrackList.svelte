<script lang="ts">
  import { CHIPTUNE_PRESETS, getPreset } from "../lib/audio/chiptune";
  import type { ChiptuneSoundId } from "../lib/audio/chiptune";
  import {
    NOTE_HEIGHT_PCT,
    laneNotes,
    noteRects,
    noteSummary,
    workingNoteCount,
  } from "../lib/song/loop-view";
  import type { Track } from "../lib/song/song";

  interface Props {
    tracks: Track[];
    selectedId: string;
    /** The visible loop, in timeline beats. */
    loop: { start: number; end: number };
    beatsPerBar: number;
    /** Playhead position in beats, or null when stopped. */
    playhead: number | null;
    maxTracks: number;
    onSelect: (id: string) => void;
    onUpdate: (
      id: string,
      changes: Partial<Pick<Track, "name" | "sound" | "volumeDb" | "isMuted">>,
    ) => void;
    onClear: (id: string) => void;
    onRemove: (id: string) => void;
    onAdd: (sound: ChiptuneSoundId) => void;
  }
  let {
    tracks,
    selectedId,
    loop,
    beatsPerBar,
    playhead,
    maxTracks,
    onSelect,
    onUpdate,
    onClear,
    onRemove,
    onAdd,
  }: Props = $props();

  const loopLength = $derived(loop.end - loop.start);
  const bars = $derived(loopLength / beatsPerBar);
  const isFull = $derived(tracks.length >= maxTracks);
  let newSound = $state<ChiptuneSoundId>("square");
  // Slider value while dragging; committed (one undo step) on release.
  let dragDb = $state<Record<string, number>>({});

  function commitName(
    track: Track,
    e: Event & { currentTarget: HTMLInputElement },
  ): void {
    const name = e.currentTarget.value.trim();
    if (name === "") e.currentTarget.value = track.name;
    else if (name !== track.name) onUpdate(track.id, { name });
  }

  function commitVolume(
    track: Track,
    e: Event & { currentTarget: HTMLInputElement },
  ): void {
    delete dragDb[track.id];
    onUpdate(track.id, { volumeDb: Number(e.currentTarget.value) });
  }
</script>

<section class="tracks" aria-label="Tracks">
  <ul role="radiogroup" aria-label="Selected track">
    {#each tracks as track, i (track.id)}
      {@const colour = getPreset(track.sound).colour}
      {@const selected = track.id === selectedId}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
      <li
        class="track"
        class:selected
        style:--track={colour}
        onclick={() => onSelect(track.id)}
      >
        <div class="controls">
          <label class="select">
            <input
              type="radio"
              name="selected-track"
              checked={selected}
              onchange={() => onSelect(track.id)}
            />
            <span class="swatch" aria-hidden="true"></span>
            <span class="sr">Select track {i + 1}: {track.name}</span>
          </label>
          <input
            class="name"
            type="text"
            aria-label="Name of track {i + 1}"
            value={track.name}
            maxlength="40"
            onchange={(e) => commitName(track, e)}
          />
          <select
            aria-label="Sound for {track.name}"
            value={track.sound}
            onchange={(e) => {
              onUpdate(track.id, {
                sound: e.currentTarget.value as ChiptuneSoundId,
              });
              e.currentTarget.blur();
            }}
          >
            {#each CHIPTUNE_PRESETS as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          <button
            type="button"
            aria-pressed={track.isMuted}
            aria-label="Mute {track.name}"
            onclick={() => onUpdate(track.id, { isMuted: !track.isMuted })}
          >
            Mute
          </button>
          <label class="vol">
            <span class="sr">Volume of {track.name}</span>
            <input
              type="range"
              min="-30"
              max="6"
              step="1"
              value={track.volumeDb}
              oninput={(e) =>
                (dragDb[track.id] = Number(e.currentTarget.value))}
              onchange={(e) => commitVolume(track, e)}
            />
            <output>{dragDb[track.id] ?? track.volumeDb} dB</output>
          </label>
          <button
            type="button"
            aria-label="Clear notes on {track.name}"
            disabled={workingNoteCount(track) === 0}
            onclick={() => onClear(track.id)}
          >
            Clear
          </button>
          <button
            type="button"
            aria-label="Delete {track.name}"
            disabled={tracks.length <= 1}
            onclick={() => onRemove(track.id)}
          >
            Delete
          </button>
        </div>
        <div class="lane-row">
          <div
            class="lane"
            aria-hidden="true"
            style:--beats={loopLength}
            style:--bars={bars}
          >
            {#each noteRects(laneNotes(track, loop), loopLength) as r (r.id)}
              <span
                class="note"
                style:left="{r.left}%"
                style:width="{r.width}%"
                style:top="{r.top}%"
                style:height="{NOTE_HEIGHT_PCT}%"
              ></span>
            {/each}
            {#if playhead !== null}
              <span
                class="playhead"
                style:left="{(playhead / loopLength) * 100}%"
              ></span>
            {/if}
          </div>
          <span class="summary" data-testid="note-summary">
            {noteSummary(workingNoteCount(track))}
          </span>
        </div>
      </li>
    {/each}
  </ul>

  <div class="add">
    <label>
      New track sound
      <select bind:value={newSound}>
        {#each CHIPTUNE_PRESETS as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </label>
    <button
      type="button"
      disabled={isFull}
      aria-describedby={isFull ? "track-limit" : undefined}
      onclick={() => onAdd(newSound)}
    >
      Add track
    </button>
    {#if isFull}
      <span id="track-limit" class="limit">
        Track limit reached ({maxTracks}). Delete one to add another.
      </span>
    {/if}
  </div>
</section>

<style>
  .tracks {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .track {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left: 0.4rem solid var(--track);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .track.selected {
    border-color: var(--color-accent);
    border-left-color: var(--track);
    box-shadow: 0 0 0 2px var(--color-accent);
  }
  .track:has(input[type="radio"]:focus-visible) {
    outline: 3px solid var(--color-accent);
    outline-offset: 2px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }
  .select {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.75rem;
  }
  .select input {
    width: 1.2rem;
    height: 1.2rem;
    margin: 0;
  }
  .swatch {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    background: var(--track);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  button,
  select,
  .name {
    font: inherit;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.25rem 0.75rem;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  button {
    cursor: pointer;
    min-width: 2.75rem;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  button[aria-pressed="true"] {
    border-color: var(--color-accent);
    box-shadow: inset 0 0 0 2px var(--color-accent);
    font-weight: 600;
  }
  .name {
    flex: 1 1 8rem;
    min-width: 0;
    max-width: 14rem;
  }
  .vol {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1 1 9rem;
    min-width: 0;
  }
  .vol input {
    flex: 1 1 4rem;
    min-width: 0;
    min-height: 2.75rem;
  }
  .vol output {
    min-width: 3.5rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }
  .lane-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .lane {
    position: relative;
    flex: 1 1 auto;
    height: 3rem;
    overflow: hidden;
    border-radius: 0.3rem;
    background-color: var(--color-bg);
    /* Strong bar lines over faint beat lines. */
    background-image:
      linear-gradient(to right, var(--color-muted) 1px, transparent 1px),
      linear-gradient(to right, var(--color-border) 1px, transparent 1px);
    background-size:
      calc(100% / var(--bars)) 100%,
      calc(100% / var(--beats)) 100%;
  }
  .note {
    position: absolute;
    border-radius: 0.25rem;
    background: var(--track);
    min-width: 3px;
    box-sizing: border-box;
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--color-text);
    /* No transition: the playhead is information, not decoration. */
  }
  .summary {
    flex: 0 0 5.5rem;
    color: var(--color-muted);
    font-size: 0.9rem;
  }
  .add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  .add label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .limit {
    color: var(--color-muted);
  }
  @media (max-width: 600px) {
    .name {
      max-width: none;
    }
    .summary {
      flex-basis: 4.5rem;
      font-size: 0.8rem;
    }
  }
</style>
