<script lang="ts">
  interface Props {
    bpm: number;
    metronomeOn: boolean;
    masterDb: number;
    onBpm: (bpm: number) => void;
    onMetronome: (isOn: boolean) => void;
    onMasterDb: (db: number) => void;
  }
  let { bpm, metronomeOn, masterDb, onBpm, onMetronome, onMasterDb }: Props =
    $props();

  function onBpmChange(e: Event & { currentTarget: HTMLInputElement }): void {
    const value = Number(e.currentTarget.value);
    if (Number.isFinite(value) && e.currentTarget.value !== "") onBpm(value);
    // Show the clamped value the song actually has.
    e.currentTarget.value = String(bpm);
  }
</script>

<section class="panel" aria-label="Song settings">
  <label>
    BPM
    <input
      type="number"
      min="40"
      max="240"
      step="1"
      value={bpm}
      onchange={onBpmChange}
    />
  </label>
  <button
    type="button"
    aria-pressed={metronomeOn}
    onclick={() => onMetronome(!metronomeOn)}
  >
    Metronome
  </button>
  <label>
    Master volume
    <input
      type="range"
      min="-40"
      max="0"
      step="1"
      value={masterDb}
      oninput={(e) => onMasterDb(Number(e.currentTarget.value))}
    />
    <output>{masterDb} dB</output>
  </label>
</section>
