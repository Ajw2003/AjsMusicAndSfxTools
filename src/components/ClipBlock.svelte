<script lang="ts">
  import type { Clip } from "../lib/song/song";
  import {
    PREVIEW_NOTE_PCT,
    clipLabel,
    clipLabels,
    clipPreview,
    repeatBoundaries,
    type DragMode,
  } from "../lib/song/timeline-view";

  interface Props {
    clip: Clip;
    trackName: string;
    /** Fallback colour (the track's sound) when the clip has none. */
    colour: string;
    beatsPerBar: number;
    pxPerBeat: number;
    selected: boolean;
    /** True while this clip is being dragged (drawn lifted). */
    dragging: boolean;
    /** True while it is being dragged to another track (drawn faded). */
    away: boolean;
    onSelect: (clipId: string) => void;
    /** Pointer moved `deltaBeats` from where the drag began, over a track (or null). */
    onDrag: (
      mode: DragMode,
      deltaBeats: number,
      overTrackId: string | null,
    ) => void;
    /** Drag finished: `commit` false means cancelled. */
    onDragEnd: (commit: boolean) => void;
    onKeydown: (e: KeyboardEvent) => void;
  }
  let {
    clip,
    trackName,
    colour,
    beatsPerBar,
    pxPerBeat,
    selected,
    dragging,
    away,
    onSelect,
    onDrag,
    onDragEnd,
    onKeydown,
  }: Props = $props();

  /** Pixels the pointer must travel before a press becomes a drag. */
  const DRAG_THRESHOLD_PX = 4;
  let gesture: { mode: DragMode; x: number; y: number; id: number } | null =
    null;
  let isDragging = false;
  // The click that follows a drag must not count as a click.
  let swallowClick = false;

  function trackUnder(x: number, y: number): string | null {
    const lane = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-track-id]");
    return lane?.dataset.trackId ?? null;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const edge = (e.target as HTMLElement).closest<HTMLElement>("[data-edge]");
    gesture = {
      mode: (edge?.dataset.edge as DragMode | undefined) ?? "move",
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
    };
    isDragging = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!gesture || e.pointerId !== gesture.id) return;
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    if (!isDragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    isDragging = true;
    onDrag(gesture.mode, dx / pxPerBeat, trackUnder(e.clientX, e.clientY));
  }

  function finish(commit: boolean): void {
    if (!gesture) return;
    gesture = null;
    if (!isDragging) return;
    isDragging = false;
    swallowClick = true;
    onDragEnd(commit);
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === "Escape" && isDragging) {
      e.preventDefault();
      finish(false);
      return;
    }
    onKeydown(e);
  }

  const preview = $derived(clipPreview(clip));
  const repeats = $derived(repeatBoundaries(clip));
  const chords = $derived(clipLabels(clip));
  const chordList = $derived(
    clip.content.kind === "notes" && clip.content.labels?.length
      ? `, chords ${clip.content.labels.map((l) => l.name).join(" ")}`
      : "",
  );
</script>

<button
  type="button"
  role="option"
  class="clip"
  class:selected
  class:dragging
  class:away
  aria-selected={selected}
  aria-label={clipLabel(clip, trackName, beatsPerBar) + chordList}
  data-clip-id={clip.id}
  style:left="{clip.startBeat * pxPerBeat}px"
  style:width="{Math.max(4, clip.lengthBeats * pxPerBeat - 2)}px"
  style:--clip={clip.colour ?? colour}
  onclick={(e) => {
    e.stopPropagation();
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    onSelect(clip.id);
  }}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={() => finish(true)}
  onpointercancel={() => finish(false)}
  onkeydown={onKey}
>
  <span class="edge left" data-edge="trim" aria-hidden="true"></span>
  <span class="edge right" data-edge="stretch" aria-hidden="true"></span>
  <span class="name" aria-hidden="true">{clip.name}</span>
  {#if chords.length > 0}
    <span class="chords" aria-hidden="true">
      {#each chords as c (c.id)}
        <span class="chord" style:left="{c.left}%">{c.name}</span>
      {/each}
    </span>
  {/if}
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
    cursor: grab;
    /* The browser must not pan the timeline while a clip is dragged. */
    touch-action: none;
    user-select: none;
  }
  .clip.dragging {
    cursor: grabbing;
    opacity: 0.85;
    z-index: 3;
  }
  .clip.away {
    opacity: 0.35;
  }
  .edge {
    position: absolute;
    top: 0;
    bottom: 0;
    /* Narrow clips keep a middle that still moves the clip. */
    width: min(0.6rem, 25%);
    z-index: 1;
    cursor: col-resize;
  }
  .edge.left {
    left: 0;
  }
  .edge.right {
    right: 0;
  }
  .clip:hover .edge,
  .clip.selected .edge {
    background: color-mix(in srgb, var(--clip) 45%, transparent);
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
  .chords {
    position: relative;
    height: 1.1em;
    flex: 0 0 auto;
  }
  .chord {
    position: absolute;
    top: 0;
    padding-left: 0.15rem;
    border-left: 2px solid var(--clip);
    font-weight: 600;
    line-height: 1.1;
    white-space: nowrap;
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
