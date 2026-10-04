<script lang="ts">
  import { onMount, tick as afterRender } from "svelte";
  import ChordBuilder from "./components/ChordBuilder.svelte";
  import ChordPads from "./components/ChordPads.svelte";
  import ClipInspector from "./components/ClipInspector.svelte";
  import Keyboard from "./components/Keyboard.svelte";
  import RecordingSettings from "./components/RecordingSettings.svelte";
  import SongFileBar from "./components/SongFileBar.svelte";
  import ReadingSettings from "./components/ReadingSettings.svelte";
  import SongSettings from "./components/SongSettings.svelte";
  import StartOverlay from "./components/StartOverlay.svelte";
  import Timeline from "./components/Timeline.svelte";
  import TimelineSettings from "./components/TimelineSettings.svelte";
  import TrackSettings from "./components/TrackSettings.svelte";
  import TransportBar from "./components/TransportBar.svelte";
  import { getPreset, type ChiptuneSoundId } from "./lib/audio/chiptune";
  import { engine } from "./lib/audio/engine";
  import { loadUi, saveUi } from "./lib/ui-storage";
  import { isTyping } from "./lib/input/is-typing";
  import { TakeRecorder } from "./lib/song/recorder";
  import {
    SongHistory,
    createSong,
    createNoteClip,
    createTrack,
    findClip,
    type ChordPad,
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
  import {
    chordName,
    chordPitches,
    progressionBeats,
    progressionContent,
    type ProgressionChord,
  } from "./lib/song/chords";

  const MAX_TRACKS = 8;
  /** Chord pads are played with the number keys 1 to 8. */
  const PAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `Digit${n}`);
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
  let countNumber = $state<number | null>(null);
  /** What was just deleted, so Undo can sit right where the mistake was. */
  let deleted = $state<string | null>(null);
  let undoButton = $state<HTMLButtonElement | undefined>();
  let isRecording = $state(false);
  let beat = $state(0);
  let metronomeOn = $state(false);
  let quantizeGrid = $state(DEFAULT_QUANTIZE);
  let loopOn = $state(false);
  let newClipBars = $state(4);
  let selectedClipId = $state<string | null>(null);
  /** Where recorded notes go, and the span the transport loops while recording. */
  let recordTargetNow = $state<RecordTarget | null>(null);
  let recordRegion: LoopRegion | null = null;
  /** The copied clip (a deep copy), pasted with a fresh id. */
  let clipboard = $state<Clip | null>(null);
  let snapGrid = $state(1);

  // ---- Panels: one open at a time, remembered in this browser ----

  type PanelId =
    | "track"
    | "clip"
    | "chords"
    | "recording"
    | "timeline"
    | "song"
    | "reading"
    | "files";
  const PANELS: { id: PanelId; label: string }[] = [
    { id: "track", label: "Track" },
    { id: "clip", label: "Clip" },
    { id: "chords", label: "Chord builder" },
    { id: "recording", label: "Recording" },
    { id: "timeline", label: "Timeline" },
    { id: "song", label: "Song" },
    { id: "reading", label: "Reading" },
    { id: "files", label: "Save & export" },
  ];
  const PANEL_KEY = "ajs-music.ui.panel";
  const KEYBOARD_KEY = "ajs-music.ui.keyboard-hidden";
  const TIPS_KEY = "ajs-music.ui.tips-hidden";
  const HINT_CHORDS_KEY = "ajs-music.ui.hint-chords-done";
  const HINT_TIMELINE_KEY = "ajs-music.ui.hint-timeline-done";

  const savedPanel = loadUi(PANEL_KEY);
  let openPanel = $state<PanelId | null>(
    PANELS.some((p) => p.id === savedPanel) ? (savedPanel as PanelId) : null,
  );
  // With no saved choice, phones start with the tips hidden: the screen is
  // too short for tips, transport and timeline above the keyboard.
  const savedTips = loadUi(TIPS_KEY);
  let isTipsHidden = $state(
    savedTips === null
      ? window.matchMedia("(max-width: 600px)").matches
      : savedTips === "true",
  );
  let isChordHintDone = $state(loadUi(HINT_CHORDS_KEY) === "true");
  let isTimelineHintDone = $state(loadUi(HINT_TIMELINE_KEY) === "true");
  let isKeyboardHidden = $state(loadUi(KEYBOARD_KEY) === "true");

  /**
   * Open a panel (or close all with null). `reveal` scrolls it into view;
   * it's off when a clip click opens the Clip panel, so the page doesn't
   * move the clip out from under the pointer.
   */
  async function setPanel(id: PanelId | null, reveal = true): Promise<void> {
    const isNew = id !== null && id !== openPanel;
    openPanel = id;
    saveUi(PANEL_KEY, id);
    if (!isNew || !reveal) return;
    // A panel opening behind the keyboard dock would look like nothing
    // happened, so bring it into view. A jump, not a smooth scroll.
    await afterRender();
    const area = document.getElementById("panel-area");
    const dock = document.querySelector(".dock");
    if (!area || !dock) return;
    const box = area.getBoundingClientRect();
    const hiddenBy = box.bottom - dock.getBoundingClientRect().top;
    if (hiddenBy <= 0) return;
    // Show its bottom edge if it fits, otherwise at least its top.
    const by = Math.min(hiddenBy + 8, box.top - 8);
    if (by > 0) window.scrollBy({ top: by, behavior: "instant" });
  }

  function togglePanel(id: PanelId): void {
    void setPanel(openPanel === id ? null : id);
  }

  async function toggleKeyboard(): Promise<void> {
    isKeyboardHidden = !isKeyboardHidden;
    saveUi(KEYBOARD_KEY, String(isKeyboardHidden));
    // The button is drawn in a different place when the keyboard is shown
    // (in its top row) and hidden (on its own), so keep focus on it.
    await afterRender();
    document
      .querySelector<HTMLElement>(".keyboard-toggle:not([hidden] *)")
      ?.focus();
  }
  let heldPadIds = $state<string[]>([]);
  let isPhone = $state(false);

  const recorder = new TakeRecorder();
  recorder.quantizeGrid = DEFAULT_QUANTIZE;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const selected = $derived<Track>(
    song.tracks.find((t) => t.id === selectedId) ?? song.tracks[0],
  );
  const preset = $derived(getPreset(selected.sound));
  const inspected = $derived(
    selectedClipId ? (findClip(song, selectedClipId) ?? null) : null,
  );
  const recordingInto = $derived.by(() => {
    const target = recordTargetNow;
    if (!isRecording || !target) return null;
    if (target.kind === "clip") {
      return findClip(song, target.clipId)?.clip.name ?? selected.name;
    }
    const trackId = target.trackId;
    return song.tracks.find((t) => t.id === trackId)?.name ?? selected.name;
  });
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
    deleted = null; // any other change replaces the message
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
    // Clicking a clip always shows that clip: predictable beats clever.
    if (clipId) void setPanel("clip", false);
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

  function onClipChange(changes: Partial<Omit<Clip, "id" | "content">>): void {
    if (!selectedClipId) return;
    history.apply({ type: "updateClip", clipId: selectedClipId, changes });
  }

  function canSplitAt(clip: Clip, at: number): boolean {
    return at > clip.startBeat && at < clip.startBeat + clip.lengthBeats;
  }

  function onSplit(): void {
    const clip = selectedClip();
    const at = engine.isPlaying ? engine.currentBeat() : beat;
    if (!clip || !canSplitAt(clip, at)) return;
    history.apply({ type: "splitClip", clipId: clip.id, atBeat: at });
  }

  function onDuplicate(): void {
    const clip = selectedClip();
    if (!clip) return;
    const newClipId = crypto.randomUUID();
    history.apply({ type: "duplicateClip", clipId: clip.id, newClipId });
    selectedClipId = newClipId;
  }

  function onCopy(): void {
    const clip = selectedClip();
    // History songs are plain data, so a structured clone is a deep copy.
    if (clip) clipboard = structuredClone(clip);
  }

  /** Paste on the selected track at the playhead (snapped to the beat). */
  function onPaste(): void {
    if (!clipboard) return;
    const track = history.song.tracks.find((t) => t.id === selectedId);
    if (!track || track.kind !== clipboard.content.kind) return;
    const clip: Clip = {
      ...structuredClone($state.snapshot(clipboard)),
      id: crypto.randomUUID(),
      startBeat: Math.max(0, Math.round(beat)),
    };
    history.apply({ type: "addClip", trackId: track.id, clip });
    selectedClipId = clip.id;
  }

  function onDeleteClip(): void {
    const clip = selectedClip();
    if (!clip) return;
    if (
      recordTargetNow?.kind === "clip" &&
      recordTargetNow.clipId === clip.id
    ) {
      endRecording();
    }
    history.apply({ type: "removeClip", clipId: clip.id });
    selectedClipId = null;
    void announceDeleted(clip.name);
  }

  /** Show "Deleted X. Undo" and move focus into it, so it is never lost. */
  async function announceDeleted(name: string): Promise<void> {
    deleted = name;
    await afterRender();
    undoButton?.focus();
  }

  function dismissDeleted(): void {
    deleted = null;
    focusTransport();
  }

  function undoDeleted(): void {
    onUndo();
    focusTransport();
  }

  function focusTransport(): void {
    void afterRender().then(() =>
      document.querySelector<HTMLElement>(".transport button")?.focus(),
    );
  }

  // ---- Chord builder ----

  let previewTimers: ReturnType<typeof setTimeout>[] = [];

  /** Play chords one after another on the selected track, at the song tempo. */
  function onPreviewChords(chords: ProgressionChord[]): void {
    if (!isReady) return;
    for (const t of previewTimers) clearTimeout(t);
    previewTimers = [];
    engine.releaseAll();
    const trackId = selected.id;
    const secondsPerBeat = 60 / history.song.bpm;
    let at = 0;
    for (const chord of chords) {
      const pitches = chordPitches(chord.root, chord.quality);
      const seconds = chord.beats * secondsPerBeat;
      previewTimers.push(
        setTimeout(() => {
          for (const p of pitches) engine.noteOn(trackId, p, 0.7);
        }, at * 1000),
        // Released a moment early so repeated chords are heard as separate.
        setTimeout(
          () => {
            for (const p of pitches) engine.noteOff(trackId, p);
          },
          (at + seconds - 0.05) * 1000,
        ),
      );
      at += seconds;
    }
  }

  /** The progression as a new clip on the selected track, at the playhead's bar. */
  function onMakeChordClip(chords: ProgressionChord[]): void {
    const track = history.song.tracks.find((t) => t.id === selectedId);
    if (!track || track.kind !== "notes" || chords.length === 0) return;
    const name = chords
      .map((c) => chordName(c.root, c.quality))
      .join(" ")
      .slice(0, 40);
    const clip = createNoteClip(
      snapDownToBar(beat, history.song.beatsPerBar),
      progressionBeats(chords),
      name,
    );
    const { notes, labels } = progressionContent(chords);
    clip.content = { kind: "notes", notes, labels };
    history.apply({ type: "addClip", trackId: track.id, clip });
    selectedClipId = clip.id;
  }

  /** Save a chord as a pad on the first free number key. */
  function onSavePad(chord: ProgressionChord): void {
    const pads = history.song.chordPads;
    const keyCode = PAD_KEYS.find((k) => !pads.some((p) => p.keyCode === k));
    if (!keyCode) return;
    history.apply({
      type: "setChordPads",
      pads: [
        ...pads,
        {
          id: crypto.randomUUID(),
          name: chordName(chord.root, chord.quality),
          pitches: chordPitches(chord.root, chord.quality),
          keyCode,
        },
      ],
    });
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
    const n = counting ? engine.countInNumber : null;
    if (n !== countNumber) countNumber = n;
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
    const name = history.song.tracks.find((t) => t.id === id)?.name;
    history.apply({ type: "removeTrack", trackId: id });
    if (name !== undefined) void announceDeleted(name);
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

  function onMasterDb(db: number): void {
    masterDb = db;
    engine.setMasterVolumeDb(masterDb);
  }

  function onClearTrack(id: string): void {
    const track = history.song.tracks.find((t) => t.id === id);
    if (!track) return;
    history.apply({
      type: "batch",
      commands: track.clips.map((c) => ({
        type: "clearClip" as const,
        clipId: c.id,
      })),
    });
  }

  /** The ▾ on a track header: show that track's settings, or hide them. */
  function onToggleTrackSettings(id: string): void {
    const isOpenForIt = openPanel === "track" && selectedId === id;
    selectTrack(id);
    void setPanel(isOpenForIt ? null : "track");
  }

  // ---- Chord pads ----

  // A pad is the whole chord on the keyboard path, so it plays on the
  // selected track and records like notes.
  function onPadDown(pad: ChordPad): void {
    if (heldPadIds.includes(pad.id)) return;
    heldPadIds = [...heldPadIds, pad.id];
    for (const pitch of pad.pitches) onNoteOn(pitch, 0.8);
  }

  function onPadUp(pad: ChordPad): void {
    if (!heldPadIds.includes(pad.id)) return;
    heldPadIds = heldPadIds.filter((id) => id !== pad.id);
    for (const pitch of pad.pitches) onNoteOff(pitch);
  }

  function releaseAllPads(): void {
    for (const pad of history.song.chordPads) onPadUp(pad);
  }

  function onRemovePad(pad: ChordPad): void {
    onPadUp(pad);
    history.apply({
      type: "setChordPads",
      pads: history.song.chordPads.filter((p) => p.id !== pad.id),
    });
  }

  function padForKey(e: KeyboardEvent): ChordPad | undefined {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    return history.song.chordPads.find((p) => p.keyCode === e.code);
  }

  function onWindowKeyup(e: KeyboardEvent): void {
    const pad = padForKey(e);
    if (pad) onPadUp(pad);
  }

  function onWindowKeydown(e: KeyboardEvent): void {
    const pad = padForKey(e);
    if (pad) {
      e.preventDefault();
      if (!e.repeat) onPadDown(pad);
      return;
    }
    if (e.altKey || isTyping(e.target)) return;
    const isCtrl = e.ctrlKey || e.metaKey;
    if (!isCtrl) {
      if (e.key === "Delete" && selectedClipId) {
        e.preventDefault();
        onDeleteClip();
      }
      return;
    }
    // Clip shortcuts, by physical key so they work on any keyboard language.
    const clipKeys: Record<string, () => void> = {
      KeyE: onSplit,
      KeyD: onDuplicate,
      KeyC: onCopy,
      KeyV: onPaste,
    };
    if (e.code === "KeyZ" && !e.shiftKey) {
      e.preventDefault();
      onUndo();
    } else if ((e.code === "KeyZ" && e.shiftKey) || e.code === "KeyY") {
      e.preventDefault();
      onRedo();
    } else if (!e.shiftKey && e.code in clipKeys) {
      // Copy with nothing selected is left to the browser (copying text).
      if (e.code === "KeyC" && !selectedClipId) return;
      e.preventDefault();
      clipKeys[e.code]();
    }
  }
</script>

<svelte:window
  onkeydown={onWindowKeydown}
  onkeyup={onWindowKeyup}
  onblur={releaseAllPads}
  onpagehide={flushSave}
/>
<svelte:document
  onvisibilitychange={() => {
    if (document.visibilityState === "hidden") flushSave();
  }}
/>

<StartOverlay {onStarted} />

{#if countNumber !== null}
  <div class="count-in" aria-hidden="true" data-testid="count-in">
    {countNumber}
  </div>
{/if}

<main>
  <!-- Space is always reserved, so the bar appearing never moves the page. -->
  {#snippet recBar()}
    {#if recordingInto !== null}
      <div class="rec-bar" role="status">
        <span class="rec-dot" aria-hidden="true"></span>
        Recording into {recordingInto} — press Record to stop
      </div>
    {/if}
  {/snippet}
  {#if !isPhone}
    <div class="rec-slot">{@render recBar()}</div>
  {/if}
  <header>
    <h1>AJ's Music & SFX Tools</h1>
    {#if !isTipsHidden}
      <div class="help">
        <ol>
          <li>Pick a sound.</li>
          <li>Press Record and play along with the loop.</li>
          <li>Select a clip to record into it, or press New clip.</li>
        </ol>
        <button
          type="button"
          onclick={() => {
            isTipsHidden = true;
            saveUi(TIPS_KEY, "true");
          }}>Hide tips</button
        >
      </div>
    {:else}
      <button
        type="button"
        class="tips-toggle"
        onclick={() => {
          isTipsHidden = false;
          saveUi(TIPS_KEY, "false");
        }}>Show tips</button
      >
    {/if}
  </header>

  <TransportBar
    {beat}
    {isPlaying}
    {isCountingIn}
    {isRecording}
    {canUndo}
    {canRedo}
    {onPlayPause}
    {onBackToStart}
    {onRecordToggle}
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
    {snapGrid}
    settingsTrackId={openPanel === "track" ? selected.id : null}
    onSelectTrack={selectTrack}
    {onSelectClip}
    {onSeek}
    {onClipEdit}
    {onUpdate}
    {onToggleTrackSettings}
  />

  {#if !isTimelineHintDone}
    <div class="hint" data-hint="timeline">
      <p>
        Click the ruler or a lane to move the playhead. Drag a clip to move it.
      </p>
      <button
        type="button"
        onclick={() => {
          isTimelineHintDone = true;
          saveUi(HINT_TIMELINE_KEY, "true");
        }}>Got it</button
      >
    </div>
  {/if}

  {#if deleted !== null}
    <div class="deleted" role="status">
      <span>Deleted {deleted}.</span>
      <button type="button" bind:this={undoButton} onclick={undoDeleted}
        >Undo</button
      >
      <button type="button" aria-label="Dismiss" onclick={dismissDeleted}
        >×</button
      >
    </div>
  {/if}

  <nav class="panel-tabs" aria-label="Panels">
    {#each PANELS as p (p.id)}
      <button
        type="button"
        aria-expanded={openPanel === p.id}
        aria-controls="panel-area"
        onclick={() => togglePanel(p.id)}
      >
        {p.label}
      </button>
    {/each}
  </nav>

  <div id="panel-area">
    {#if openPanel === "track"}
      <TrackSettings
        track={selected}
        trackCount={song.tracks.length}
        maxTracks={MAX_TRACKS}
        onUpdate={(changes) => onUpdate(selected.id, changes)}
        onClear={() => onClearTrack(selected.id)}
        onRemove={() => onRemove(selected.id)}
        {onAdd}
      />
    {:else if openPanel === "clip"}
      {#if inspected}
        <ClipInspector
          clip={inspected.clip}
          trackColour={getPreset(inspected.track.sound).colour}
          beatsPerBar={song.beatsPerBar}
          canSplit={canSplitAt(inspected.clip, beat)}
          canPaste={clipboard !== null &&
            clipboard.content.kind === selected.kind}
          onChange={onClipChange}
          {onSplit}
          {onDuplicate}
          {onCopy}
          {onPaste}
          onDelete={onDeleteClip}
        />
      {:else}
        <p class="panel hint-only">
          Click a clip on the timeline to change it here.
        </p>
      {/if}
    {:else if openPanel === "chords"}
      {#if !isChordHintDone}
        <div class="hint" data-hint="chords">
          <p>
            Pick a key, tap chords to add them, then make them into a clip on
            the selected track.
          </p>
          <button
            type="button"
            onclick={() => {
              isChordHintDone = true;
              saveUi(HINT_CHORDS_KEY, "true");
            }}>Got it</button
          >
        </div>
      {/if}
      <ChordBuilder
        trackName={selected.kind === "notes" ? selected.name : null}
        beatsPerBar={song.beatsPerBar}
        canAddPad={song.chordPads.length < PAD_KEYS.length}
        onPreview={onPreviewChords}
        onMakeClip={onMakeChordClip}
        {onSavePad}
      />
    {:else if openPanel === "recording"}
      <RecordingSettings
        {newClipBars}
        {quantizeGrid}
        onNewClipBars={(bars) => (newClipBars = bars)}
        {onNewClip}
        onQuantize={(g) => {
          quantizeGrid = g;
          recorder.quantizeGrid = g;
        }}
      />
    {:else if openPanel === "timeline"}
      <TimelineSettings
        {loopOn}
        region={song.loopRegion}
        beatsPerBar={song.beatsPerBar}
        {snapGrid}
        {onLoop}
        {onLoopRegion}
        onSnap={(g) => (snapGrid = g)}
      />
    {:else if openPanel === "song"}
      <SongSettings
        bpm={song.bpm}
        {metronomeOn}
        {masterDb}
        onBpm={(bpm) => history.apply({ type: "setBpm", bpm })}
        onMetronome={(on) => (metronomeOn = on)}
        {onMasterDb}
      />
    {:else if openPanel === "reading"}
      <ReadingSettings />
    {:else if openPanel === "files"}
      <SongFileBar {song} {onReplace} />
    {/if}
  </div>

  {#snippet keyboardToggle()}
    <button
      type="button"
      class="keyboard-toggle"
      aria-expanded={!isKeyboardHidden}
      aria-controls="keyboard"
      onclick={toggleKeyboard}
    >
      {isKeyboardHidden ? "Show keyboard" : "Hide keyboard"}
    </button>
  {/snippet}
  <div class="dock">
    <!-- On a phone the bar sits by the keys, so it never covers the page. -->
    {#if isPhone}{@render recBar()}{/if}
    {#if isKeyboardHidden}
      {@render keyboardToggle()}
    {/if}
    {#if song.chordPads.length > 0}
      <ChordPads
        pads={song.chordPads}
        heldIds={heldPadIds}
        {onPadDown}
        {onPadUp}
        onRemove={onRemovePad}
      />
    {/if}
    <div id="keyboard" hidden={isKeyboardHidden}>
      <Keyboard
        {onNoteOn}
        {onNoteOff}
        colour={preset.colour}
        drums={isDrums}
        octaves={isPhone && !isDrums ? 1 : 2}
        bind:octave
        controls={keyboardToggle}
      />
    </div>
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1rem;
    color: var(--color-muted);
  }
  .help ol {
    margin: 0;
    padding-left: 2.25em;
  }
  .help button,
  .tips-toggle {
    font: inherit;
    min-height: 2.75rem;
    padding: 0.25rem 0.9rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .tips-toggle {
    align-self: flex-start;
  }
  .panel-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .panel-tabs button,
  .keyboard-toggle {
    font: inherit;
    min-height: 2.75rem;
    padding: 0.25rem 0.9rem;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .panel-tabs button[aria-expanded="true"] {
    border-color: var(--color-accent);
    box-shadow: inset 0 0 0 2px var(--color-accent);
    font-weight: 600;
  }
  .keyboard-toggle {
    align-self: flex-start;
    min-height: 2.25rem;
    font-size: 0.9rem;
  }
  .rec-slot {
    min-height: 2.5rem;
    margin: -0.5rem 0 0;
  }
  .rec-bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    min-height: 2.5rem;
    padding: 0.25rem 1rem;
    box-sizing: border-box;
    font-size: 1.1rem;
    font-weight: 600;
    color: #ffffff;
    background: #b00020;
    border-bottom: 2px solid #ffffff;
  }
  .rec-dot {
    flex: none;
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    background: #ffffff;
  }
  .count-in {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 15;
    pointer-events: none;
    min-width: 1.6em;
    text-align: center;
    font-size: 8rem;
    font-weight: 700;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
    background: var(--color-bg);
    border: 4px solid var(--color-error);
    border-radius: 1rem;
    opacity: 0.95;
  }
  .hint,
  .deleted {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
  }
  .hint p {
    margin: 0;
    flex: 1 1 14rem;
  }
  .deleted span {
    flex: 1 1 auto;
  }
  .hint button,
  .deleted button {
    font: inherit;
    min-height: 2.75rem;
    min-width: 2.75rem;
    padding: 0.25rem 0.9rem;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .hint-only {
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
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  @media (max-width: 600px) {
    main {
      padding: 0.75rem 0.75rem 0;
      gap: 0.75rem;
    }
    h1 {
      font-size: 1.25rem;
    }
    .rec-bar {
      position: static;
      margin: -0.5rem -0.75rem 0;
    }
    .dock {
      margin: auto -0.75rem 0;
      padding: 0.5rem 0.75rem calc(0.5rem + env(safe-area-inset-bottom));
    }
  }
</style>
