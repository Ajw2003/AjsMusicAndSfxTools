<script lang="ts">
  import { getPreset } from "../lib/audio/chiptune";
  import { noteSummary } from "../lib/song/loop-view";
  import type { Track } from "../lib/song/song";
  import { trackNoteCount } from "../lib/song/timeline-view";

  interface Props {
    track: Track;
    index: number;
    selected: boolean;
    settingsOpen: boolean;
    settingsId: string;
    onSelect: (id: string) => void;
    onToggleMute: () => void;
    onToggleSettings: () => void;
  }
  let {
    track,
    index,
    selected,
    settingsOpen,
    settingsId,
    onSelect,
    onToggleMute,
    onToggleSettings,
  }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="header"
  class:selected
  style:--track={getPreset(track.sound).colour}
  onclick={() => onSelect(track.id)}
>
  <label class="select">
    <input
      type="radio"
      name="selected-track"
      checked={selected}
      onchange={() => onSelect(track.id)}
    />
    <span class="swatch" aria-hidden="true"></span>
    <span class="sr">Select track {index + 1}: {track.name}</span>
    <span class="name" aria-hidden="true">{track.name}</span>
  </label>
  <span class="summary" data-testid="note-summary">
    {noteSummary(trackNoteCount(track))}
  </span>
  <div class="buttons">
    <button
      type="button"
      aria-pressed={track.isMuted}
      aria-label="Mute {track.name}"
      onclick={(e) => {
        e.stopPropagation();
        onToggleMute();
      }}
    >
      Mute
    </button>
    <button
      type="button"
      aria-expanded={settingsOpen}
      aria-controls={settingsId}
      aria-label="Track settings for {track.name}"
      onclick={(e) => {
        e.stopPropagation();
        onToggleSettings();
      }}
    >
      <span aria-hidden="true">{settingsOpen ? "▴" : "▾"}</span>
    </button>
  </div>
</div>

<style>
  .header {
    box-sizing: border-box;
    height: 100%;
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 0 0.25rem;
    padding: 0.2rem 0.4rem;
    background: var(--color-surface);
    border-left: 0.4rem solid var(--track);
    cursor: pointer;
  }
  .header.selected {
    box-shadow: inset 0 0 0 2px var(--color-accent);
  }
  .header:has(input[type="radio"]:focus-visible) {
    outline: 3px solid var(--color-accent);
    outline-offset: -3px;
  }
  .select {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
    min-height: 2.75rem;
  }
  .select input {
    flex: 0 0 auto;
    width: 1.1rem;
    height: 1.1rem;
    margin: 0;
  }
  .swatch {
    flex: 0 0 auto;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    background: var(--track);
  }
  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 600;
  }
  .summary {
    grid-column: 1;
    color: var(--color-muted);
    font-size: 0.8rem;
  }
  .buttons {
    grid-column: 2;
    grid-row: 1 / span 2;
    display: flex;
    gap: 0.25rem;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  button {
    font: inherit;
    box-sizing: border-box;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.25rem;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  button[aria-pressed="true"] {
    border-color: var(--color-accent);
    box-shadow: inset 0 0 0 2px var(--color-accent);
    font-weight: 600;
  }
  @media (max-width: 600px) {
    .header {
      grid-template-columns: 1fr;
      padding: 0.2rem 0.25rem;
    }
    .summary {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .buttons {
      grid-column: 1;
      grid-row: auto;
    }
  }
</style>
