<script lang="ts">
  import type { LoopRegion } from "../lib/song/song";
  import { SNAP_OPTIONS } from "../lib/song/timeline-view";

  interface Props {
    loopOn: boolean;
    region: LoopRegion | null;
    beatsPerBar: number;
    snapGrid: number;
    onLoop: (isOn: boolean) => void;
    onLoopRegion: (startBeat: number, endBeat: number) => void;
    onSnap: (grid: number) => void;
  }
  let {
    loopOn,
    region,
    beatsPerBar,
    snapGrid,
    onLoop,
    onLoopRegion,
    onSnap,
  }: Props = $props();

  const fromBar = $derived(region ? region.startBeat / beatsPerBar + 1 : 1);
  const toBar = $derived(region ? region.endBeat / beatsPerBar : 4);

  /** Loop in/out are typed as 1-based bar numbers; "to" is inclusive. */
  function setBars(from: number, to: number): void {
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;
    const start = Math.max(1, Math.round(from));
    const end = Math.max(start, Math.round(to));
    onLoopRegion((start - 1) * beatsPerBar, end * beatsPerBar);
  }
</script>

<section class="panel" aria-label="Timeline settings">
  <button type="button" aria-pressed={loopOn} onclick={() => onLoop(!loopOn)}>
    Loop
  </button>
  <label>
    Repeat bars
    <input
      type="number"
      min="1"
      value={fromBar}
      onchange={(e) => setBars(Number(e.currentTarget.value), toBar)}
    />
  </label>
  <label>
    to
    <input
      type="number"
      min="1"
      value={toBar}
      onchange={(e) => setBars(fromBar, Number(e.currentTarget.value))}
    />
  </label>
  <label>
    Line clips up to:
    <select
      value={snapGrid}
      onchange={(e) => {
        onSnap(Number(e.currentTarget.value));
        e.currentTarget.blur();
      }}
    >
      {#each SNAP_OPTIONS as o (o.value)}
        <option value={o.value}>{o.label}</option>
      {/each}
    </select>
  </label>
</section>
