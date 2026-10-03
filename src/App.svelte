<script lang="ts">
  import { onMount } from "svelte";
  import Keyboard from "./components/Keyboard.svelte";
  import SongFileBar from "./components/SongFileBar.svelte";
  import StartOverlay from "./components/StartOverlay.svelte";
  import TrackList from "./components/TrackList.svelte";
  import TransportBar from "./components/TransportBar.svelte";
  import { getPreset, type ChiptuneSoundId } from "./lib/audio/chiptune";
  import { engine } from "./lib/audio/engine";
  import { isTyping } from "./lib/input/is-typing";
  import { TakeRecorder } from "./lib/song/recorder";
  import {
    SongHistory,
    createSong,
    createNoteClip,
    createTrack,
    type Song,
    type SongCommand,
    type Track,
  } from "./lib/song/song";
  import { loopSpan, workingClip } from "./lib/song/loop-view";
  import { loadAutosave, saveAutosave } from "./lib/song/storage";

  const MAX_TRACKS = 8;
  const DEFAULT_QUANTIZE = 0.25;
  const AUTOSAVE_DELAY_MS = 800;

  const history = new SongHistory(loadAutosave(localStorage) ?? createSong());
  let song = $state<Song>(history.song);
  let canUndo = $state(false);
  let canRedo = $state(false);
  let selectedId = $state(history.song.tracks[0].id);
  let masterDb = $state(-6);
  let isReady = $state(false);

  let isPlaying = $state(false);
  let isCountingIn = $state(false);
  let isRecording = $state(false);
  let beat = $state(0);
  let metronomeOn = $state(false);
  let quantizeGrid = $state(DEFAULT_QUANTIZE);
  let isPhone = $state(false);

  const recorder = new TakeRecorder();
  recorder.quantizeGrid = DEFAULT_QUANTIZE;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const selected = $derived<Track>(
    song.tracks.find((t) => t.id === selectedId) ?? song.tracks[0],
  );
  const preset = $derived(getPreset(selected.sound));
  const isDrums = $derived(selected.sound === "noise");
  const loop = $derived(loopSpan(song));
  const loopLength = $derived(loop.end - loop.start);
  const showPlayhead = $derived(isPlaying && !isCountingIn);

  // Kick (below C4) must be reachable on drum tracks, so they start at C3.
  let octave = $derived(isDrums ? 3 : 4);
  $effect(() => {
    if (isReady) engine.setMetronome(metronomeOn);
  });

  /** Push the song to the engine. Muting works by not scheduling notes. */
  function applySong(s: Song): void {
    if (!isReady) return;
    engine.syncTracks(s.tracks);
    engine.setSong(s);
  }

  function flushSave(): void {
    if (saveTimer === undefined) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    saveAutosave(localStorage, history.song);
  }

  let isFirstSubscribe = true;
  history.subscribe((s) => {
    song = s;
    canUndo = history.canUndo;
    canRedo = history.canRedo;
    if (!s.tracks.some((t) => t.id === selectedId)) {
      selectedId = s.tracks[0].id;
    }
    applySong(s);
    if (isFirstSubscribe) {
      isFirstSubscribe = false;
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      saveAutosave(localStorage, s);
    }, AUTOSAVE_DELAY_MS);
  });

  function onStarted(): void {
    engine.setMasterVolumeDb(masterDb);
    isReady = true;
    applySong(history.song);
  }

  // ---- Recording ----

  /** Position in the loop (0 at the loop start), in beats. */
  function loopBeat(): number {
    return engine.currentBeat() - loopSpan(history.song).start;
  }

  function commitNotes(
    trackId: string,
    notes: ReturnType<typeof recorder.collect>,
  ) {
    if (notes.length === 0) return;
    const song = history.song;
    const track = song.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clip = workingClip(track);
    if (clip) {
      history.apply({ type: "addNotesToClip", clipId: clip.id, notes });
      return;
    }
    // No clip yet on this track: make one the length of the loop, then record.
    const { start, end } = loopSpan(song);
    const created = createNoteClip(start, end - start, track.name);
    history.apply({
      type: "batch",
      commands: [
        { type: "addClip", trackId, clip: created },
        { type: "addNotesToClip", clipId: created.id, notes },
      ],
    });
  }

  function commitTake(): void {
    const { start, end } = loopSpan(history.song);
    commitNotes(selectedId, recorder.collect(end - start));
  }

  function flushTake(): void {
    const { start, end } = loopSpan(history.song);
    commitNotes(selectedId, recorder.flushAll(loopBeat(), end - start));
  }

  /** The Bars select: the loop AND every track's working clip become this long. */
  function onBars(bars: number): void {
    const length = Math.min(8, Math.max(1, Math.round(bars))) * 4;
    const commands: SongCommand[] = [
      { type: "setLoopRegion", region: { startBeat: 0, endBeat: length } },
    ];
    for (const t of history.song.tracks) {
      const c = workingClip(t);
      if (c) {
        commands.push({
          type: "updateClip",
          clipId: c.id,
          changes: { lengthBeats: length, loopBeats: length },
        });
      }
    }
    history.apply({ type: "batch", commands });
  }

  function stopAll(): void {
    if (isRecording) flushTake();
    isRecording = false;
    engine.stop();
    isPlaying = false;
    isCountingIn = false;
    beat = 0;
    prevBeat = null;
  }

  function onPlayStop(): void {
    if (!isReady) return;
    if (isPlaying || isCountingIn || engine.isPlaying) stopAll();
    else engine.play();
  }

  function onRecordToggle(): void {
    if (!isReady) return;
    if (isRecording) {
      flushTake();
      isRecording = false;
      return;
    }
    isRecording = true;
    if (!engine.isPlaying && !engine.isCountingIn) engine.playWithCountIn(4);
  }

  function selectTrack(id: string): void {
    if (id === selectedId) return;
    // Notes played so far belong to the track they were played on.
    if (isRecording && engine.isPlaying) flushTake();
    engine.releaseAll();
    selectedId = id;
  }

  // Watches the transport: mirrors state into the UI and, when the loop
  // wraps, commits the pass just played as ONE undo step.
  let prevBeat: number | null = null;
  let frame = 0;
  function tick(): void {
    frame = requestAnimationFrame(tick);
    if (!isReady) return;
    const playing = engine.isPlaying;
    const counting = engine.isCountingIn;
    if (playing !== isPlaying) isPlaying = playing;
    if (counting !== isCountingIn) isCountingIn = counting;
    if (!playing) {
      prevBeat = null;
      if (beat !== 0) beat = 0;
      return;
    }
    const b = engine.currentBeat() - loopSpan(history.song).start;
    if (prevBeat !== null && b < prevBeat && isRecording) commitTake();
    prevBeat = b;
    beat = b;
  }

  onMount(() => {
    frame = requestAnimationFrame(tick);
    const mq = window.matchMedia("(max-width: 600px)");
    const onMq = () => (isPhone = mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => {
      cancelAnimationFrame(frame);
      mq.removeEventListener("change", onMq);
      flushSave();
    };
  });

  // ---- Keyboard play ----

  // Live play always sounds on the selected track. Keys pressed before audio
  // has started (e.g. the key that dismissed the overlay) are ignored.
  function onNoteOn(midi: number, velocity: number): void {
    if (!isReady) return;
    engine.noteOn(selected.id, midi, velocity);
    if (isRecording && engine.isPlaying && !engine.isCountingIn) {
      recorder.noteOn(midi, velocity, loopBeat());
    }
  }
  function onNoteOff(midi: number): void {
    if (!isReady) return;
    engine.noteOff(selected.id, midi);
    if (engine.isPlaying) recorder.noteOff(midi, loopBeat());
  }

  // ---- Song edits ----

  function onUpdate(
    id: string,
    changes: Partial<Pick<Track, "name" | "sound" | "volumeDb" | "isMuted">>,
  ): void {
    if (changes.sound) engine.releaseAll();
    history.apply({ type: "updateTrack", trackId: id, changes });
  }

  function onAdd(sound: ChiptuneSoundId): void {
    const track = createTrack(sound);
    history.apply({ type: "addTrack", track });
    selectTrack(track.id);
  }

  function onRemove(id: string): void {
    if (id === selectedId && isRecording && engine.isPlaying) flushTake();
    engine.releaseAll();
    history.apply({ type: "removeTrack", trackId: id });
  }

  function onReplace(next: Song): void {
    stopAll();
    history.replace(next);
  }

  function onUndo(): void {
    history.undo();
  }
  function onRedo(): void {
    history.redo();
  }

  function onMasterInput(e: Event & { currentTarget: HTMLInputElement }): void {
    masterDb = Number(e.currentTarget.value);
    engine.setMasterVolumeDb(masterDb);
  }

  function onWindowKeydown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
    if (e.code === "KeyZ" && !e.shiftKey) {
      e.preventDefault();
      onUndo();
    } else if ((e.code === "KeyZ" && e.shiftKey) || e.code === "KeyY") {
      e.preventDefault();
      onRedo();
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} onpagehide={flushSave} />
<svelte:document
  onvisibilitychange={() => {
    if (document.visibilityState === "hidden") flushSave();
  }}
/>

<StartOverlay {onStarted} />

<main>
  <header>
    <h1>AJ's Music & SFX Tools</h1>
    <p class="help">
      Pick a sound, press Record, play along with the loop. Add tracks to layer.
    </p>
  </header>

  <TransportBar
    bpm={song.bpm}
    bars={loopLength / song.beatsPerBar}
    {beat}
    {isPlaying}
    {isCountingIn}
    {isRecording}
    {canUndo}
    {canRedo}
    {metronomeOn}
    {quantizeGrid}
    {onPlayStop}
    {onRecordToggle}
    onBpm={(bpm) => history.apply({ type: "setBpm", bpm })}
    {onBars}
    onMetronome={(on) => (metronomeOn = on)}
    onQuantize={(g) => {
      quantizeGrid = g;
      recorder.quantizeGrid = g;
    }}
    {onUndo}
    {onRedo}
  />

  <TrackList
    tracks={song.tracks}
    selectedId={selected.id}
    {loop}
    beatsPerBar={song.beatsPerBar}
    playhead={showPlayhead ? beat : null}
    maxTracks={MAX_TRACKS}
    onSelect={selectTrack}
    {onUpdate}
    onClear={(id) => {
      const track = song.tracks.find((t) => t.id === id);
      const clip = track && workingClip(track);
      if (clip) history.apply({ type: "clearClip", clipId: clip.id });
    }}
    {onRemove}
    {onAdd}
  />

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

  <SongFileBar {song} {onReplace} />

  <div class="dock">
    <Keyboard
      {onNoteOn}
      {onNoteOff}
      colour={preset.colour}
      drums={isDrums}
      octaves={isPhone && !isDrums ? 1 : 2}
      bind:octave
    />
  </div>
</main>

<style>
  main {
    box-sizing: border-box;
    max-width: 60rem;
    min-height: 100dvh;
    margin: 0 auto;
    padding: 1rem 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  .help {
    margin: 0;
    color: var(--color-muted);
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
  /* Pinned to the bottom of the viewport; stays in the flow, so nothing
     is ever hidden behind it. */
  .dock {
    position: sticky;
    bottom: 0;
    z-index: 5;
    margin: auto -1rem 0;
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
  }
  @media (max-width: 600px) {
    main {
      padding: 0.75rem 0.75rem 0;
      gap: 0.75rem;
    }
    .dock {
      margin: auto -0.75rem 0;
      padding: 0.5rem 0.75rem calc(0.5rem + env(safe-area-inset-bottom));
    }
  }
</style>
