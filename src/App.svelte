<script lang="ts">
  import Keyboard from "./components/Keyboard.svelte";
  import StartOverlay from "./components/StartOverlay.svelte";
  import {
    CHIPTUNE_PRESETS,
    getPreset,
    type ChiptuneSoundId,
  } from "./lib/audio/chiptune";
  import { engine } from "./lib/audio/engine";
  import { SongHistory, createSong, type Song } from "./lib/song/song";

  const history = new SongHistory(createSong());
  let song = $state<Song>(history.song);
  history.subscribe((s) => (song = s));

  // Chunk 3 will let the user pick the armed track; for now it is the first.
  const track = $derived(song.tracks[0]);
  const preset = $derived(getPreset(track.sound));

  let masterDb = $state(-6);
  let isReady = $state(false);

  function onStarted(): void {
    engine.setMasterVolumeDb(masterDb);
    engine.syncTracks(song.tracks);
    isReady = true;
  }

  function chooseSound(sound: ChiptuneSoundId): void {
    if (sound === track.sound) return;
    engine.releaseAll();
    history.apply({
      type: "updateTrack",
      trackId: track.id,
      changes: { sound },
    });
    if (isReady) engine.syncTracks(history.song.tracks);
  }

  function onMasterInput(e: Event & { currentTarget: HTMLInputElement }): void {
    masterDb = Number(e.currentTarget.value);
    engine.setMasterVolumeDb(masterDb);
  }

  // Keys pressed before audio has started (e.g. the key that dismissed the
  // overlay) are ignored rather than throwing.
  function onNoteOn(midi: number, velocity: number): void {
    if (isReady) engine.noteOn(track.id, midi, velocity);
  }
  function onNoteOff(midi: number): void {
    if (isReady) engine.noteOff(track.id, midi);
  }
</script>

<StartOverlay {onStarted} />

<main>
  <h1>AJ's Music & SFX Tools</h1>

  <fieldset class="sounds">
    <legend>Sound</legend>
    {#each CHIPTUNE_PRESETS as p (p.id)}
      <label class="sound" class:selected={p.id === track.sound}>
        <input
          type="radio"
          name="sound"
          value={p.id}
          checked={p.id === track.sound}
          onchange={() => chooseSound(p.id)}
        />
        <span class="swatch" style:background={p.colour} aria-hidden="true"
        ></span>
        {p.name}
      </label>
    {/each}
  </fieldset>

  <label class="volume">
    Master volume
    <input
      type="range"
      min="-40"
      max="0"
      step="1"
      value={masterDb}
      oninput={onMasterInput}
    />
    <output>{masterDb} dB</output>
  </label>

  <Keyboard {onNoteOn} {onNoteOff} colour={preset.colour} />
</main>

<style>
  main {
    box-sizing: border-box;
    max-width: 60rem;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0.5rem 0.75rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  .sound {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .sound.selected {
    border-color: var(--color-accent);
  }
  .sound:has(input:focus-visible) {
    outline: 3px solid var(--color-accent);
    outline-offset: 2px;
  }
  .sound input {
    width: 1.1rem;
    height: 1.1rem;
    margin: 0;
  }
  .swatch {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
  }
  .volume {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .volume input {
    flex: 1 1 10rem;
    min-height: 2.75rem;
  }
  .volume output {
    min-width: 4rem;
    color: var(--color-muted);
  }
</style>
