<script lang="ts">
  import type { Clip } from "../lib/song/song";
  import {
    PREVIEW_NOTE_PCT,
    clipLabel,
    clipPreview,
    repeatBoundaries,
  } from "../lib/song/timeline-view";

  interface Props {
    clip: Clip;
    trackName: string;
    /** Fallback colour (the track's sound) when the clip has none. */
    colour: string;
    beatsPerBar: number;
    pxPerBeat: number;
    selected: boolean;
    onSelect: (clipId: string) => void;
  }
  let {
    clip,
    trackName,
    colour,
    beatsPerBar,
    pxPerBeat,
    selected,
    onSelect,
  }: Props = $props();

  const preview = $derived(clipPreview(clip));
  const repeats = $derived(repeatBoundaries(clip));
</script>

<button
  type="button"
  role="option"
  class="clip"
  class:selected
  aria-selected={selected}
  aria-label={clipLabel(clip, trackName, beatsPerBar)}
  data-clip-id={clip.id}
  style:left="{clip.startBeat * pxPerBeat}px"
  style:width="{Math.max(4, clip.lengthBeats * pxPerBeat - 2)}px"
  style:--clip={clip.colour ?? colour}
  onclick={(e) => {
    e.stopPropagation();
    onSelect(clip.id);
  }}
>
  <span class="name" aria-hidden="true">{clip.name}</span>
  <span class="preview" aria-hidden="true">
    {#each repeats as x (x)}
      <span class="repeat" style:left="{x}%"></span>
    {/each}
    {#each preview as r (r.id)}
      <span
        class="note"
        style:left="{r.left}%"
        style:width="{r.width}%"
        style:top="{r.top}%"
        style:height="{PREVIEW_NOTE_PCT}%"
      ></span>
    {/each}
  </span>
</button>

<style>
  .clip {
    position: absolute;
    top: 0.25rem;
    bottom: 0.25rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.15rem 0.3rem;
    overflow: hidden;
    font: inherit;
    font-size: 0.75rem;
    text-align: left;
    color: var(--color-text);
    /* Tinted with the clip colour, solid edge so it reads at a glance. */
    background: color-mix(in srgb, var(--clip) 30%, var(--color-surface));
    border: 1px solid var(--clip);
    border-radius: 0.4rem;
    cursor: pointer;
  }
  .clip.selected {
    outline: 3px solid var(--color-text);
    outline-offset: -1px;
    z-index: 1;
  }
  .clip:focus-visible {
    outline: 3px solid var(--color-accent);
    outline-offset: 1px;
    z-index: 2;
  }
  .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.1;
  }
  .preview {
    position: relative;
    flex: 1 1 auto;
    min-height: 0.75rem;
  }
  .repeat {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--color-muted);
    opacity: 0.5;
  }
  .note {
    position: absolute;
    min-width: 2px;
    border-radius: 1px;
    background: var(--clip);
  }
</style>
