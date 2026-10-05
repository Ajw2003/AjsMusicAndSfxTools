<script lang="ts">
  import { getPreset } from "../lib/audio/chiptune";
  import { positionLabel } from "../lib/song/loop-view";
  import {
    songEndBeat,
    type Clip,
    type Song,
    type Track,
  } from "../lib/song/song";
  import {
    DEFAULT_ZOOM,
    MAX_ZOOM,
    MIN_ZOOM,
    dragClip,
    pxToBeat,
    rulerTicks,
    stepZoom,
    timelineWidth,
    type ClipPlacement,
    type DragMode,
  } from "../lib/song/timeline-view";
  import ClipBlock from "./ClipBlock.svelte";
  import TrackHeader from "./TrackHeader.svelte";

  interface Props {
    song: Song;
    selectedTrackId: string;
    selectedClipId: string | null;
    /** Playhead position in timeline beats. */
    playhead: number;
    /** Keep the playhead in view (while playing). */
    follow: boolean;
    loopOn: boolean;
    /** Beats per snap step for dragging; 0 is off. */
    snapGrid: number;
    /** Track whose settings panel is open, for the ▾ buttons' state. */
    settingsTrackId: string | null;
    onSelectTrack: (id: string) => void;
    onSelectClip: (trackId: string, clipId: string | null) => void;
    onSeek: (beat: number) => void;
    /** Place a clip (one undo step), possibly on another track. */
    onClipEdit: (
      clipId: string,
      toTrackId: string,
      placement: ClipPlacement,
    ) => void;
    onUpdate: (id: string, changes: Partial<Pick<Track, "isMuted">>) => void;
    onToggleTrackSettings: (id: string) => void;
  }
  let {
    song,
    selectedTrackId,
    selectedClipId,
    playhead,
    follow,
    loopOn,
    snapGrid,
    settingsTrackId,
    onSelectTrack,
    onSelectClip,
    onSeek,
    onClipEdit,
    onUpdate,
    onToggleTrackSettings,
  }: Props = $props();

  const bpb = $derived(song.beatsPerBar);
  let pxPerBeat = $state(DEFAULT_ZOOM);
  let visibleWidth = $state(0);
  let scroller: HTMLDivElement;

  // A recording runs on past the song end; the view grows with the playhead.
  const endBeat = $derived(Math.max(songEndBeat(song), Math.ceil(playhead)));
  const width = $derived(timelineWidth(endBeat, bpb, pxPerBeat, visibleWidth));
  const totalBeats = $derived(Math.floor(width / pxPerBeat));
  const ticks = $derived(rulerTicks(totalBeats, bpb, pxPerBeat));
  const region = $derived(song.loopRegion);

  /** The clip being dragged and where it would land, or null. */
  let drag = $state<{
    clipId: string;
    fromTrackId: string;
    toTrackId: string;
    mode: DragMode;
    deltaBeats: number;
  } | null>(null);

  function canHold(trackId: string, from: Track): boolean {
    const to = song.tracks.find((t) => t.id === trackId);
    return to !== undefined && to.kind === from.kind;
  }

  /** Where the dragged clip would land, or null when nothing is dragged. */
  const dragPlaced = $derived.by((): Clip | null => {
    if (!drag) return null;
    const d = drag;
    const from = song.tracks.find((t) => t.id === d.fromTrackId);
    const clip = from?.clips.find((c) => c.id === d.clipId);
    if (!clip) return null;
    return { ...clip, ...dragClip(clip, d.mode, d.deltaBeats, snapGrid) };
  });

  /**
   * The clips drawn in a lane. The dragged clip stays in its own lane (it
   * holds the pointer, so it must not unmount); it follows the pointer
   * there, or stays put and dims while a ghost shows it on another track.
   */
  function laneClips(track: Track): Clip[] {
    const placed = dragPlaced;
    if (!drag || !placed || drag.fromTrackId !== track.id) return track.clips;
    if (drag.toTrackId !== track.id) return track.clips;
    return track.clips.map((c) => (c.id === placed.id ? placed : c));
  }

  function startOrUpdateDrag(
    track: Track,
    clip: Clip,
    mode: DragMode,
    deltaBeats: number,
    overTrackId: string | null,
  ): void {
    // Only a move can change track, and only to a track of the same kind.
    const keep = drag?.toTrackId ?? track.id;
    const toTrackId =
      mode === "move" && overTrackId && canHold(overTrackId, track)
        ? overTrackId
        : keep;
    drag = {
      clipId: clip.id,
      fromTrackId: track.id,
      toTrackId,
      mode,
      deltaBeats,
    };
  }

  function endDrag(clip: Clip, commit: boolean): void {
    const d = drag;
    drag = null;
    if (!commit || !d) return;
    const placement = dragClip(clip, d.mode, d.deltaBeats, snapGrid);
    const isSame =
      d.toTrackId === d.fromTrackId &&
      placement.startBeat === clip.startBeat &&
      placement.lengthBeats === clip.lengthBeats &&
      placement.offsetBeats === clip.offsetBeats;
    if (!isSame) onClipEdit(clip.id, d.toTrackId, placement);
  }

  /**
   * Keyboard equivalents of dragging a focused clip: arrows move it by one
   * snap step (a beat when snap is off), Shift+arrows move its right edge,
   * Alt+arrows its left edge, Up/Down move it to the next track.
   */
  function onClipKeydown(track: Track, clip: Clip, e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey) return;
    const step = snapGrid || 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const mode: DragMode = e.shiftKey
        ? "stretch"
        : e.altKey
          ? "trim"
          : "move";
      const delta = e.key === "ArrowRight" ? step : -step;
      onClipEdit(clip.id, track.id, dragClip(clip, mode, delta, snapGrid));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const i = song.tracks.findIndex((t) => t.id === track.id);
      const dir = e.key === "ArrowDown" ? 1 : -1;
      for (let j = i + dir; j >= 0 && j < song.tracks.length; j += dir) {
        const to = song.tracks[j];
        if (to.kind !== track.kind) continue;
        onClipEdit(clip.id, to.id, {
          startBeat: clip.startBeat,
          lengthBeats: clip.lengthBeats,
          offsetBeats: clip.offsetBeats,
        });
        // Keep focus on the clip as it changes lane.
        queueMicrotask(() =>
          scroller
            .querySelector<HTMLElement>(`[data-clip-id="${clip.id}"]`)
            ?.focus(),
        );
        return;
      }
    }
  }

  /** Width of the sticky track-header column, read from CSS. */
  function headerWidth(): number {
    const first = scroller?.querySelector<HTMLElement>(".corner");
    return first ? first.offsetWidth : 0;
  }

  // While playing, page the view along so the playhead never leaves it.
  // A jump rather than a smooth scroll: calm by default.
  $effect(() => {
    // Not while scrubbing: the view would jump out from under the pointer.
    if (!follow || !scroller || scrub) return;
    const x = playhead * pxPerBeat;
    const lanesWidth = scroller.clientWidth - headerWidth();
    const left = scroller.scrollLeft;
    if (x < left || x > left + lanesWidth - 16) {
      scroller.scrollLeft = Math.max(0, x - 16);
    }
  });

  function zoom(direction: 1 | -1): void {
    // Keep the playhead at the same place on screen.
    const before = playhead * pxPerBeat - scroller.scrollLeft;
    pxPerBeat = stepZoom(pxPerBeat, direction);
    queueMicrotask(() => {
      scroller.scrollLeft = Math.max(0, playhead * pxPerBeat - before);
    });
  }

  function beatFromEvent(e: MouseEvent, el: HTMLElement): number {
    const x = e.clientX - el.getBoundingClientRect().left;
    // Ruler clicks land on the nearest beat: precise enough, easy to hit.
    return Math.round(pxToBeat(x, pxPerBeat));
  }

  /** A press-and-drag on the ruler or an empty lane moves the playhead. */
  let scrub = $state<{ pointerId: number; el: HTMLElement } | null>(null);

  function startScrub(e: PointerEvent): void {
    // Clips handle their own drags.
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-clip-id]")) return;
    const el = e.currentTarget as HTMLElement;
    // Stops the browser starting a text selection.
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    scrub = { pointerId: e.pointerId, el };
    onSeek(beatFromEvent(e, el));
  }

  function moveScrub(e: PointerEvent): void {
    if (scrub?.pointerId !== e.pointerId) return;
    onSeek(beatFromEvent(e, scrub.el));
  }

  function endScrub(e: PointerEvent): void {
    if (scrub?.pointerId === e.pointerId) scrub = null;
  }

  function onRulerKeydown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 0.25 : 1;
    const moves: Record<string, number> = {
      ArrowLeft: playhead - step,
      ArrowRight: playhead + step,
      ArrowDown: playhead - step,
      ArrowUp: playhead + step,
      PageDown: playhead - bpb,
      PageUp: playhead + bpb,
      Home: 0,
      End: endBeat,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    onSeek(Math.max(0, moves[e.key]));
  }
</script>

<section class="timeline" aria-label="Timeline">
  <div class="toolbar">
    <span class="zoom" role="group" aria-label="Zoom">
      <button
        type="button"
        disabled={pxPerBeat <= MIN_ZOOM}
        onclick={() => zoom(-1)}>Zoom out</button
      >
      <button
        type="button"
        disabled={pxPerBeat >= MAX_ZOOM}
        onclick={() => zoom(1)}>Zoom in</button
      >
    </span>
  </div>

  <div
    class="scroller"
    bind:this={scroller}
    bind:clientWidth={visibleWidth}
    style:--px-per-beat="{pxPerBeat}px"
    style:--bar-px="{pxPerBeat * bpb}px"
  >
    <div class="grid" style:--width="{width}px">
      <div class="corner">
        <span class="sr">Track</span>
      </div>
      <div
        class="ruler"
        role="slider"
        tabindex="0"
        aria-label="Playhead"
        aria-valuemin="0"
        aria-valuemax={endBeat}
        aria-valuenow={playhead}
        aria-valuetext={positionLabel(playhead, bpb)}
        onpointerdown={startScrub}
        onpointermove={moveScrub}
        onpointerup={endScrub}
        onpointercancel={endScrub}
        onkeydown={onRulerKeydown}
      >
        {#if region}
          <span
            class="region"
            class:off={!loopOn}
            style:left="{region.startBeat * pxPerBeat}px"
            style:width="{(region.endBeat - region.startBeat) * pxPerBeat}px"
          ></span>
        {/if}
        {#each ticks as t (t.beat)}
          <span
            class="tick"
            class:bar={t.isBar}
            style:left="{t.beat * pxPerBeat}px"
          >
            {#if t.label !== null}<span class="label">{t.label}</span>{/if}
          </span>
        {/each}
        <span class="playhead" style:left="{playhead * pxPerBeat}px"></span>
      </div>

      <div class="rows" role="radiogroup" aria-label="Selected track">
        {#each song.tracks as track, i (track.id)}
          {@const colour = getPreset(track.sound).colour}
          <div class="head">
            <TrackHeader
              {track}
              index={i}
              selected={track.id === selectedTrackId}
              settingsOpen={settingsTrackId === track.id}
              settingsId="track-settings"
              onSelect={onSelectTrack}
              onToggleMute={() =>
                onUpdate(track.id, { isMuted: !track.isMuted })}
              onToggleSettings={() => onToggleTrackSettings(track.id)}
            />
          </div>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="lane"
            class:selected={track.id === selectedTrackId}
            class:muted={track.isMuted}
            class:drop={drag !== null &&
              drag.toTrackId === track.id &&
              drag.fromTrackId !== track.id}
            data-track-id={track.id}
            role="listbox"
            tabindex="-1"
            aria-label="Clips on {track.name}"
            onpointerdown={(e) => {
              if ((e.target as HTMLElement).closest("[data-clip-id]")) return;
              onSelectClip(track.id, null);
              // A finger swipe on a lane scrolls the timeline, so touch
              // seeks with a tap (the click below) instead of scrubbing.
              if (e.pointerType !== "touch") startScrub(e);
            }}
            onpointermove={moveScrub}
            onpointerup={endScrub}
            onpointercancel={endScrub}
            onclick={(e) => {
              if ((e.target as HTMLElement).closest("[data-clip-id]")) return;
              onSeek(beatFromEvent(e, e.currentTarget));
            }}
          >
            {#each laneClips(track) as clip (clip.id)}
              {@const original =
                track.clips.find((c) => c.id === clip.id) ?? clip}
              <ClipBlock
                {clip}
                trackName={track.name}
                {colour}
                beatsPerBar={bpb}
                {pxPerBeat}
                selected={clip.id === selectedClipId}
                dragging={drag?.clipId === clip.id}
                away={drag?.clipId === clip.id && drag.toTrackId !== track.id}
                onSelect={(id) => onSelectClip(track.id, id)}
                onDrag={(mode, delta, over) =>
                  startOrUpdateDrag(track, original, mode, delta, over)}
                onDragEnd={(commit) => endDrag(original, commit)}
                onKeydown={(e) => onClipKeydown(track, original, e)}
              />
            {/each}
            {#if drag && dragPlaced && drag.toTrackId === track.id && drag.fromTrackId !== track.id}
              <span
                class="ghost"
                style:left="{dragPlaced.startBeat * pxPerBeat}px"
                style:width="{dragPlaced.lengthBeats * pxPerBeat}px"
              ></span>
            {/if}
            <span class="playhead" style:left="{playhead * pxPerBeat}px"></span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .timeline {
    --head: 15rem;
    --row: 4.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }
  .zoom {
    display: flex;
    gap: 0.5rem;
  }
  button {
    font: inherit;
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0.25rem 0.75rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
    min-width: 2.75rem;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* The only sideways scroll is inside this box, never the page. */
  .scroller {
    overflow-x: auto;
    overflow-y: hidden;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-bg);
  }
  .grid {
    /* Dragging across the timeline scrubs; it never selects text. */
    user-select: none;
    -webkit-user-select: none;
    display: grid;
    grid-template-columns: var(--head) var(--width);
    width: max-content;
  }
  .rows {
    display: contents;
  }
  .corner,
  .head {
    position: sticky;
    left: 0;
    z-index: 3;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
  }
  .corner {
    border-bottom: 1px solid var(--color-border);
  }
  .head {
    height: var(--row);
    border-bottom: 1px solid var(--color-border);
  }
  .ruler {
    position: relative;
    height: 1.75rem;
    border-bottom: 1px solid var(--color-border);
    cursor: ew-resize;
    overflow: hidden;
    /* Dragging along the ruler scrubs, even with a finger. */
    touch-action: none;
  }
  .ruler:focus-visible {
    outline-offset: -3px;
  }
  .tick {
    position: absolute;
    bottom: 0;
    height: 0.4rem;
    border-left: 1px solid var(--color-border);
  }
  .tick.bar {
    height: 100%;
    border-left-color: var(--color-muted);
  }
  .label {
    position: absolute;
    top: 0.15rem;
    left: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
    /* The tick is a zero-width box: without this, "10" stacks as 1 over 0. */
    white-space: nowrap;
  }
  .region {
    position: absolute;
    top: 0;
    bottom: 0;
    background: color-mix(in srgb, var(--color-accent) 35%, transparent);
  }
  .region.off {
    background: color-mix(in srgb, var(--color-muted) 18%, transparent);
  }
  .lane {
    position: relative;
    height: var(--row);
    border-bottom: 1px solid var(--color-border);
    /* Strong bar lines over faint beat lines. */
    background-image:
      linear-gradient(to right, var(--color-border) 1px, transparent 1px),
      linear-gradient(
        to right,
        color-mix(in srgb, var(--color-border) 40%, transparent) 1px,
        transparent 1px
      );
    background-size:
      var(--bar-px) 100%,
      var(--px-per-beat) 100%;
    cursor: pointer;
  }
  .lane.selected {
    background-color: color-mix(in srgb, var(--color-accent) 7%, transparent);
  }
  .ghost {
    position: absolute;
    top: 0.25rem;
    bottom: 0.25rem;
    box-sizing: border-box;
    border: 2px dashed var(--color-accent);
    border-radius: 0.4rem;
    pointer-events: none;
  }
  .lane.drop {
    box-shadow: inset 0 0 0 2px var(--color-accent);
  }
  .lane.muted {
    opacity: 0.55;
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--color-text);
    pointer-events: none;
    z-index: 2;
    /* No transition: the playhead is information, not decoration. */
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (max-width: 600px) {
    .timeline {
      --head: 6.5rem;
      --row: 5.5rem;
    }
  }
</style>
