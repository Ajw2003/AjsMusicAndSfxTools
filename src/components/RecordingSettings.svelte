<script lang="ts">
  interface Props {
    newClipBars: number;
    quantizeGrid: number;
    onNewClipBars: (bars: number) => void;
    onNewClip: () => void;
    onQuantize: (grid: number) => void;
  }
  let {
    newClipBars,
    quantizeGrid,
    onNewClipBars,
    onNewClip,
    onQuantize,
  }: Props = $props();

  const BARS = [1, 2, 4, 8];
  const QUANTIZE = [
    { value: 0, label: "Off" },
    { value: 0.25, label: "1/4 beat (1/16 note)" },
    { value: 0.5, label: "1/2 beat (1/8 note)" },
    { value: 1, label: "1 beat" },
  ];
</script>

<section class="panel" aria-label="Recording settings">
  <label>
    Quantize
    <select
      value={quantizeGrid}
      onchange={(e) => {
        onQuantize(Number(e.currentTarget.value));
        e.currentTarget.blur();
      }}
    >
      {#each QUANTIZE as q (q.value)}
        <option value={q.value}>{q.label}</option>
      {/each}
    </select>
  </label>
  <label>
    New clip length
    <select
      value={newClipBars}
      onchange={(e) => {
        onNewClipBars(Number(e.currentTarget.value));
        e.currentTarget.blur();
      }}
    >
      {#each BARS as b (b)}
        <option value={b}>{b} {b === 1 ? "bar" : "bars"}</option>
      {/each}
    </select>
  </label>
  <button type="button" onclick={onNewClip}>New clip</button>
</section>
