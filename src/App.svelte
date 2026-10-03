<script lang="ts">
  import { onMount } from "svelte";
  import Keyboard from "./components/Keyboard.svelte";
  import SongFileBar from "./components/SongFileBar.svelte";
  import StartOverlay from "./components/StartOverlay.svelte";
  import Timeline from "./components/Timeline.svelte";
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
    findClip,
    type Clip,
    type LoopRegion,
    type Note,
    type Song,
    type SongCommand,
    type Track,
  } from "./lib/song/song";
  import {
    recordTarget,
    snapDownToBar,
    toClipSource,
    type ClipPlacement,
    type RecordTarget,
  } from "./lib/song/timeline-view";
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
  let loopOn = $state(false);
  let newClipBars = $state(4);
  let selectedClipId = $state<string | null>(null);
  /** Where recorded notes go, and the span the transport loops while recording. */
  let recordTargetNow: RecordTarget | null = null;
  let recordRegion: LoopRegion | null = null;
  let isPhone = $state(false);

  const recorder = new TakeRecorder();
  recorder.quantizeGrid = DEFAULT_QUANTIZE;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const selected = $derived<Track>(
    song.tracks.find((t) => t.id === selectedId) ?? song.tracks[0],
  );
  const preset = $derived(getPreset(selected.sound));
  const isDrums = $derived(selected.sound === "noise");

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
    if (selectedClipId && !findClip(s, selectedClipId)) selectedClipId = null;
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
    engine.setLoopEnabled(loopOn);
    engine.seek(beat);
  }

  // ---- Transport ----

  /** Set the loop region (the toggle stays as it is). */
  function onLoopRegion(startBeat: number, endBeat: number): void {
    history.apply({ type: "setLoopRegion", region: { startBeat, endBeat } });
  }

  function onLoop(isOn: boolean): void {
    // Turning the loop on with no region loops the selected clip, else 4 bars.
    if (isOn && !history.song.loopRegion) {
      const clip = selectedClip();
      onLoopRegion(
        clip ? clip.startBeat : 0,
        clip ? clip.startBeat + clip.lengthBeats : 16,
      );
    }
    loopOn = isOn;
    if (isReady) engine.setLoopEnabled(isOn);
  }

  function onSeek(to: number): void {
    if (!isReady) {
      beat = to;
      return;
    }
    // While recording, the engine keeps the playhead inside the clip.
    engine.seek(to);
    beat = engine.currentBeat();
    prevBeat = null;
  }

  function endRecording(): void {
    if (isRecording) flushTake();
    isRecording = false;
    recordRegion = null;
    if (isReady) engine.setLoopOverride(null);
  }

  function onPlayPause(): void {
    if (!isReady) return;
    if (isPlaying || isCountingIn || engine.isPlaying) {
      endRecording();
      engine.pause();
      isPlaying = false;
      isCountingIn = false;
      beat = engine.currentBeat();
      prevBeat = null;
    } else {
      engine.play();
    }
  }

  function onBackToStart(): void {
    if (!isReady) {
      beat = 0;
      return;
    }
    endRecording();
    engine.stop();
    isPlaying = false;
    isCountingIn = false;
    beat = 0;
    prevBeat = null;
  }

  // ---- Clips ----

  function selectedClip(): Clip | null {
    if (!selectedClipId) return null;
    return findClip(history.song, selectedClipId)?.clip ?? null;
  }

  function onSelectClip(trackId: string, clipId: string | null): void {
    selectTrack(trackId);
    selectedClipId = clipId;
  }

  /** New empty clip on the selected track, at the bar under the playhead. */
  function onNewClip(): void {
    const track = history.song.tracks.find((t) => t.id === selectedId);
    if (!track || track.kind !== "notes") return;
    const start = snapDownToBar(beat, history.song.beatsPerBar);
    const clip = createNoteClip(
      start,
      newClipBars * history.song.beatsPerBar,
      track.name,
    );
    history.apply({ type: "addClip", trackId: track.id, clip });
    selectedClipId = clip.id;
  }

  /** Apply a drag or keyboard placement as ONE undo step. */
  function onClipEdit(
    clipId: string,
    toTrackId: string,
    placement: ClipPlacement,
  ): void {
    const found = findClip(history.song, clipId);
    if (!found) return;
    const commands: SongCommand[] = [];
    if (found.track.id !== toTrackId) {
      commands.push({
        type: "moveClip",
        clipId,
        toTrackId,
        startBeat: placement.startBeat,
      });
    }
    commands.push({ type: "updateClip", clipId, changes: placement });
    history.apply(
      commands.length === 1 ? commands[0] : { type: "batch", commands },
    );
    if (found.track.id !== toTrackId) selectTrack(toTrackId);
    selectedClipId = clipId;
    // A clip being recorded into keeps recording over its new place.
    if (
      isRecording &&
      recordTargetNow?.kind === "clip" &&
      recordTargetNow.clipId === clipId
    ) {
      aimRecording(recordTargetNow);
    }
  }

  // ---- Recording ----

  /**
   * Recording loops over one span of the timeline: the target clip's first
   * pass (one source loop), or where a new clip will go.
   */
  function regionFor(target: RecordTarget): LoopRegion {
    const song = history.song;
    if (target.kind === "clip") {
      const found = findClip(song, target.clipId);
      if (found) {
        const c = found.clip;
        return {
          startBeat: c.startBeat,
          endBeat: c.startBeat + Math.min(c.lengthBeats, c.loopBeats),
        };
      }
    }
    const start = target.kind === "new" ? target.startBeat : 0;
    return {
      startBeat: start,
      endBeat: start + newClipBars * song.beatsPerBar,
    };
  }

  /** Aim recording at a target and loop the transport over its span. */
  function aimRecording(target: RecordTarget): void {
    recordTargetNow = target;
    recordRegion = regionFor(target);
    if (target.kind === "clip") selectedClipId = target.clipId;
    engine.setLoopOverride(recordRegion);
    prevBeat = null;
  }

  /** Position inside the recording span (0 at its start), in beats. */
  function recordBeat(): number {
    return engine.currentBeat() - (recordRegion?.startBeat ?? 0);
  }

  function recordLength(): number {
    return recordRegion ? recordRegion.endBeat - recordRegion.startBeat : 16;
  }

  function commitNotes(notes: Note[]): void {
    const target = recordTargetNow;
    if (notes.length === 0 || !target) return;
    const song = history.song;
    if (target.kind === "clip") {
      const found = findClip(song, target.clipId);
      if (!found) return;
      history.apply({
        type: "addNotesToClip",
        clipId: found.clip.id,
        notes: toClipSource(notes, found.clip),
      });
      return;
    }
    const track = song.tracks.find((t) => t.id === target.trackId);
    if (!track) return;
    // The new clip is only made once something was actually played into it.
    const created = createNoteClip(
      target.startBeat,
      recordLength(),
      track.name,
    );
    history.apply({
      type: "batch",
      commands: [
        { type: "addClip", trackId: track.id, clip: created },
        { type: "addNotesToClip", clipId: created.id, notes },
      ],
    });
    recordTargetNow = { kind: "clip", clipId: created.id };
    selectedClipId = created.id;
  }

  function commitTake(): void {
    commitNotes(recorder.collect(recordLength()));
  }

  function flushTake(): void {
    commitNotes(recorder.flushAll(recordBeat(), recordLength()));
  }

  function onRecordToggle(): void {
    if (!isReady) return;
    if (isRecording) {
      endRecording();
      return;
    }
    const at = engine.isPlaying ? engine.currentBeat() : beat;
    aimRecording(recordTarget(history.song, selectedId, selectedClipId, at));
    isRecording = true;
    if (!engine.isPlaying && !engine.isCountingIn) engine.playWithCountIn(4);
  }

  function selectTrack(id: string): void {
    if (id === selectedId) return;
    // Notes played so far belong to the track they were played on.
    if (isRecording && engine.isPlaying) flushTake();
    engine.releaseAll();
    selectedId = id;
    selectedClipId = null;
    if (isRecording && recordRegion) {
      // Keep recording over the same span, now on this track.
      aimRecording(
        recordTarget(history.song, id, null, recordRegion.startBeat),
      );
    }
  }

  // Watches the transport: mirrors state into the UI and, when a recording
  // pass wraps, commits the pass just played as ONE undo step.
  let prevBeat: number | null = null;
  let frame = 0;
  function tick(): void {
    frame = requestAnimationFrame(tick);
    if (!isReady) return;
    const playing = engine.isPlaying;
    const counting = engine.isCountingIn;
    if (playing !== isPlaying) isPlaying = playing;
    if (counting !== isCountingIn) isCountingIn = counting;
    const b = engine.currentBeat();
    if (b !== beat) beat = b;
    if (!playing) {
      // Playback ran to the end of the song and stopped by itself.
      if (isRecording && !counting) endRecording();
      prevBeat = null;
      return;
    }
    if (prevBeat !== null && b < prevBeat && isRecording) commitTake();
    prevBeat = b;
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
      recorder.noteOn(midi, velocity, recordBeat());
    }
  }
  function onNoteOff(midi: number): void {
    if (!isReady) return;
    engine.noteOff(selected.id, midi);
    if (engine.isPlaying) recorder.noteOff(midi, recordBeat());
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
    if (id === selectedId) endRecording();
    engine.releaseAll();
    history.apply({ type: "removeTrack", trackId: id });
  }

  function onReplace(next: Song): void {
    onBackToStart();
    selectedClipId = null;
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
      Pick a sound, press Record, play along with the loop. Select a clip to
      record into it; New clip adds one at the playhead. Add tracks to layer.
    </p>
  </header>

  <TransportBar
    bpm={song.bpm}
    {newClipBars}
    {beat}
    {loopOn}
    {isPlaying}
    {isCountingIn}
    {isRecording}
    {canUndo}
    {canRedo}
    {metronomeOn}
    {quantizeGrid}
    {onPlayPause}
    {onBackToStart}
    {onLoop}
    {onNewClip}
    {onRecordToggle}
    onBpm={(bpm) => history.apply({ type: "setBpm", bpm })}
    onNewClipBars={(bars) => (newClipBars = bars)}
    onMetronome={(on) => (metronomeOn = on)}
    onQuantize={(g) => {
      quantizeGrid = g;
      recorder.quantizeGrid = g;
    }}
    {onUndo}
    {onRedo}
  />

  <Timeline
    {song}
    selectedTrackId={selected.id}
    {selectedClipId}
    playhead={beat}
    follow={isPlaying && !isCountingIn}
    {loopOn}
    maxTracks={MAX_TRACKS}
    onSelectTrack={selectTrack}
    {onSelectClip}
    {onSeek}
    {onLoopRegion}
    {onClipEdit}
    {onUpdate}
    onClear={(id) => {
      const track = song.tracks.find((t) => t.id === id);
      if (!track) return;
      history.apply({
        type: "batch",
        commands: track.clips.map((c) => ({
          type: "clearClip" as const,
          clipId: c.id,
        })),
      });
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
