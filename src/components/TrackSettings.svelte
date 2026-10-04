<script lang="ts">
  import { CHIPTUNE_PRESETS } from "../lib/audio/chiptune";
  import type { ChiptuneSoundId } from "../lib/audio/chiptune";
  import type { Track } from "../lib/song/song";
  import { trackNoteCount } from "../lib/song/timeline-view";

  interface Props {
    track: Track;
    trackCount: number;
    maxTracks: number;
    onUpdate: (
      changes: Partial<Pick<Track, "name" | "sound" | "volumeDb">>,
    ) => void;
    onClear: () => void;
    onRemove: () => void;
    onAdd: (sound: ChiptuneSoundId) => void;
  }
  let {
    track,
    trackCount,
    maxTracks,
    onUpdate,
    onClear,
    onRemove,
    onAdd,
  }: Props = $props();

  let newSound = $state<ChiptuneSoundId>("square");
  // Slider value while dragging; committed (one undo step) on release.
  let dragDb = $state<number | null>(null);
  const isFull = $derived(trackCount >= maxTracks);

  function commitName(e: Event & { currentTarget: HTMLInputElement }): void {
    const name = e.currentTarget.value.trim();
    if (name === "") e.currentTarget.value = track.name;
    else if (name !== track.name) onUpdate({ name });
  }
</script>

<section class="panel" id="track-settings" aria-label="Track {track.name}">
  <label>
    Name
    <input
      type="text"
      value={track.name}
      maxlength="40"
      onchange={commitName}
    />
  </label>
  <label>
    Sound
    <select
      value={track.sound}
      onchange={(e) => {
        onUpdate({ sound: e.currentTarget.value as ChiptuneSoundId });
        e.currentTarget.blur();
      }}
    >
      {#each CHIPTUNE_PRESETS as p (p.id)}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
  </label>
  <label>
    Volume
    <input
      type="range"
      min="-30"
      max="6"
      step="1"
      value={track.volumeDb}
      aria-valuetext="{dragDb ?? track.volumeDb} decibels"
      oninput={(e) => (dragDb = Number(e.currentTarget.value))}
      onchange={(e) => {
        dragDb = null;
        onUpdate({ volumeDb: Number(e.currentTarget.value) });
      }}
    />
    <output>{dragDb ?? track.volumeDb}</output>
  </label>
  <button
    type="button"
    aria-label="Clear notes on {track.name}"
    disabled={trackNoteCount(track) === 0}
    onclick={onClear}
  >
    Clear notes
  </button>
  <button
    type="button"
    aria-label="Delete {track.name}"
    disabled={trackCount <= 1}
    onclick={onRemove}
  >
    Delete track
  </button>

  <span class="add">
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
  </span>
  {#if isFull}
    <p id="track-limit" class="hint">
      Track limit reached ({maxTracks}). Delete one to add another.
    </p>
  {/if}
</section>

<style>
  .add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
</style>
