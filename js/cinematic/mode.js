import { createCinematicTimeline } from "./timeline-controller.js?v=0.1.0";
import { normalizeTemporalFeatures, observedFeaturesAt, parsePlaybackValue, temporalModelInExtent } from "./temporal-adapter.js?v=0.3.1";
import { exportCinematicSpec, importCinematicSpec } from "./state.js?v=0.2.9-strata";
import { CINEMATIC_EFFECTS, NATIVE_EFFECTS, effectFields, effectRanges, resolveEffect, resolveQuality } from "./cinematic-effects.js?v=0.69.9-order";
import { PROVENANCE_STATUSES, createEffectsClock, normalizeTiming } from "./clock.js?v=0.1.0";
import { setEffectClock } from "./effects-three.js?v=0.69.9-order";

// In a build-up, outlines older than the newest few are "settled": drawn as a
// cheap edge and rebuilt only now and then, while the recent ones (full
// flames) are rebuilt each step. Settling keeps RECENT_MIN recent records; the
// next settle is due once the recent set has doubled.
const RECENT_MIN = 120;
// Auto detail steps down a tier (never up) while playback stays slower than
// SLOW_FRAME_MS a frame for SLOW_STEPS steps in a row. Only decoration lightens.
const TIERS = ["eco", "balanced", "cinematic"];
const SLOW_FRAME_MS = 45;
const SLOW_STEPS = 3;

// Engine adapters may implement a transient operation synchronously (for
// example, removing an already-loaded Three.js item) or asynchronously. Keep
// optional cleanup safe in either case, including unsupported adapters.
const MAX_FEATURES = 50000;
const uniqueIds = (observations) => [...new Set(observations.map((observation) => observation.id))]
  .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
const attempt = (operation, fallback = null) => Promise.resolve().then(operation).catch(() => fallback);

/**
 * Bridges the shared cinematic clock to the active engine's transient feature
 * filter. It never edits the layer's saved definition expression or geometry.
 */
export class CinematicModeController {
  constructor({ mapController, onState = () => {} } = {}) {
    this.mapController = mapController;
    this.onState = onState;
    this.layers = new Map();
    this.timeline = null;
    this.unsubscribe = null;
    this.spec = null;
    this.pendingSnapshot = null;
    this.renderTask = null;
    this.renderedObservationTime = null;
    this.renderedTimeMode = null;
    this.localWindow = false;
    this.localModels = new Map();
    this.localEmpty = false;
    this.adaptive = { cap: TIERS.length - 1, slow: 0 };
    this.effectStats = null;
  }

  async load(spec, { featuresByLayer = {} } = {}) {
    await this.destroy();
    this.spec = importCinematicSpec(spec);
    this.adaptive = { cap: TIERS.length - 1, slow: 0 };
    // One master clock for every effect: pause, seek and speed apply to all tracks together.
    this.effectsClock = createEffectsClock({ playing: this.spec.cinematic.clock.effectsPlaying });
    this.effectsClock.setRate(this.spec.cinematic.clock.effectsRate);
    setEffectClock(this.effectsClock);
    for (const config of this.spec.cinematic.layers) await this.#loadLayer(config, featuresByLayer);
    this.#resetTimeline();
    await this.renderTask;
    return this.state();
  }

  /** Query, model and take over one track's layer (filter, opacity, its own effect paused). */
  async #loadLayer(config, featuresByLayer = {}) {
    const layer = this.#layerForRef(config.layerRef);
    if (!layer?.queryable) throw new Error(`Cinematic layer “${config.layerRef}” is not queryable.`);
    if (this.layers.has(layer.uid)) throw new Error(`${layer.title} is already a track in this scene.`);
    const loaded = featuresByLayer[config.layerRef] ? { features: featuresByLayer[config.layerRef], truncated: false } : await this.#queryAll(layer, config.temporal.startField);
    const { features } = loaded;
    const model = normalizeTemporalFeatures(features, {
      kind: config.temporal.kind || "time",
      steps: config.temporal.steps || 0,
      timeField: config.temporal.startField,
      groupField: config.temporal.groupField,
      objectIdField: config.temporal.featureIdField || layer.objectIdField,
    });
    if (!model.ticks.length) throw new Error(config.temporal.kind === "number" ? `No numeric values were found in ${config.temporal.startField} of ${layer.title}.` : config.temporal.kind === "none" ? `${layer.title} has no features to animate.` : `No valid timestamped observations were found in ${layer.title}.`);
    const previousOpacity = Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1;
    const effectRange = effectRanges(features, effectFields(layer.fields || [], features[0]?.attributes || features[0]?.properties));
    this.layers.set(layer.uid, { layer, config, model, effectRange, truncated: loaded.truncated, effectUid: `cinematic:${this.spec.cinematic.id}:${layer.uid}`, previousOpacity, previousFilter: await attempt(() => this.mapController.getFeatureFilter(layer.uid)) });
    if (config.animation.opacity != null) await attempt(() => this.mapController.setOpacity(layer.uid, config.animation.opacity), false);
    // The layer's own Advanced Style effect would double the cinematic one; it returns on exit.
    await attempt(() => this.mapController.suspendLayerEffect?.(layer.uid, true), false);
  }

  /**
   * A project-local cinematic scene normally names a layer uid. A Clip inside
   * a shared Brief instead names its durable FeatureServer URL, because a new
   * browser session necessarily assigns a new uid. Resolve both forms before
   * loading the track so a portable Brief can play its embedded Clip.
   */
  #layerForRef(ref) {
    const direct = this.mapController.getLayer(ref);
    if (direct) return direct;
    const clean = (value) => String(value || '').replace(/\/+$/, '').toLowerCase();
    const wanted = clean(ref);
    if (!wanted || !/^https?:\/\//.test(wanted)) return null;
    return (this.mapController.getLayers?.() || []).find((candidate) => {
      const config = this.mapController.getLayerConfig?.(candidate) || {};
      return [config.url, candidate.url].some((url) => clean(url) === wanted);
    }) || null;
  }

  /**
   * Add another layer to the scene as a track: Ambient (always shown, its
   * effect looping) or stepping on the same timeline as the lead track.
   */
  async addTrack({ layerRef, kind = "none", startField = null, steps, effect = "auto" } = {}) {
    if (!this.spec) throw new Error("Start Cinematic mode first.");
    const next = importCinematicSpec({ ...this.spec.cinematic, layers: [...this.spec.cinematic.layers, { layerRef, temporal: { kind, startField, steps }, animation: { effect: { type: effect, intensity: 1 } } }] });
    const config = next.cinematic.layers.at(-1);
    await this.#loadLayer(config);
    this.spec.cinematic.layers.push(config);
    this.#resetTimeline();
    await this.renderTask;
    return this.state();
  }

  /** Remove a track and give its layer back as it was. The last track can't be removed. */
  async removeTrack(layerUid) {
    const entry = this.layers.get(layerUid);
    if (!entry || !this.spec) return false;
    if (this.layers.size <= 1) throw new Error("A scene needs at least one track.");
    await this.renderTask?.catch(() => {});
    await this.#restoreLayer(entry);
    this.layers.delete(layerUid);
    this.localModels.delete(layerUid);
    this.spec.cinematic.layers = this.spec.cinematic.layers.filter((config) => config !== entry.config);
    this.#resetTimeline();
    await this.renderTask;
    return true;
  }

  /**
   * A map layer can be deleted from the Layers panel while it is a cinematic
   * track. Its MapLibre source has already gone at that point, so restoring a
   * filter or opacity is neither useful nor safe. Remove just the controller's
   * transient overlays and forget the track instead.
   */
  async removeDeletedLayer(layerUid) {
    const entry = this.layers.get(layerUid);
    if (!entry) return false;
    // Finish any queued render before clearing its effect IDs. This keeps a
    // pending shader build from surviving the deletion cleanup.
    await this.renderTask?.catch(() => {});
    if (!this.layers.has(layerUid)) return false;
    this.pendingSnapshot = null;
    await this.#clearTrackEffects(entry);
    this.layers.delete(layerUid);
    this.localModels.delete(layerUid);
    if (this.spec) this.spec.cinematic.layers = this.spec.cinematic.layers.filter((config) => config !== entry.config);
    if (!this.layers.size) {
      if (this.effectsClock) { setEffectClock(null); this.effectsClock = null; }
      this.unsubscribe?.(); this.unsubscribe = null;
      this.timeline?.destroy(); this.timeline = null;
      this.localWindow = false; this.localEmpty = false;
      this.spec = null;
      this.renderedObservationTime = null; this.renderedTimeMode = null;
      this.onState(this.state());
      return true;
    }
    this.#resetTimeline();
    await this.renderTask;
    return true;
  }

  async #restoreLayer({ layer, effectUid, previousFilter, previousOpacity }) {
    await attempt(() => this.mapController.setFeatureFilter(layer.uid, previousFilter), false);
    await attempt(() => this.mapController.setOpacity(layer.uid, previousOpacity), false);
    await attempt(() => this.mapController.suspendLayerEffect?.(layer.uid, false), false);
    await this.#clearTrackEffects({ effectUid });
  }

  async #clearTrackEffects({ effectUid }) {
    if (typeof this.mapController.clearCinematicEffect !== "function") return;
    await attempt(() => this.mapController.clearCinematicEffect(effectUid), false);
    await attempt(() => this.mapController.clearCinematicEffect(`${effectUid}:settled`), false);
  }

  /** An Ambient track beside a stepping one: always fully shown, its effect looping. */
  #ambient(entry) {
    return entry.config.temporal.kind === "none" && this.valueKind() !== "none";
  }

  /** The records a track shows at `time`. */
  #observedAt(entry, time, timeMode) {
    const model = this.localModels.get(entry.layer.uid) || entry.model;
    return this.#ambient(entry) ? model.observations : observedFeaturesAt(model, time, { timeMode });
  }

  state() {
    const timeline = this.timeline?.state() || null;
    const timeMode = this.spec?.cinematic.clock.timeMode || "instant";
    return {
      spec: this.spec ? exportCinematicSpec(this.spec) : null, timeline, localWindow: this.localWindow, localEmpty: this.localEmpty, valueKind: this.valueKind(),
      effects: this.effectsClock ? { playing: this.effectsClock.playing, rate: this.effectsClock.rate, seconds: Math.round(this.effectsClock.seconds() * 10) / 10 } : null,
      // Live when asked (an Ambient scene has no steps to refresh it), else the last step's.
      detail: { quality: this.spec?.cinematic.quality || "auto", lightened: this.adaptive.cap < TIERS.length - 1 ? TIERS[this.adaptive.cap] : null, stats: (this.spec && this.#readStats()) || this.effectStats },
      layers: [...this.layers.values()].map((entry) => {
        const { layer, model, config, truncated } = entry;
        const activeModel = this.localModels.get(layer.uid) || model;
        const effect = this.#effectFor(layer, config);
        return { uid: layer.uid, title: layer.title, ticks: activeModel.ticks, invalid: model.invalid, timeField: config.temporal.startField,
          kind: config.temporal.kind || "time", ambient: this.#ambient(entry), effectType: config.animation.effect?.type || "none",
          timing: { ...config.animation.timing }, visible: config.animation.visible !== false, color: config.animation.effect?.color || null, provenance: config.provenance?.status || "illustrative",
          effect, effectNote: CINEMATIC_EFFECTS[effect]?.note || "", loadedCount: model.observations.length + model.invalid.length, truncated,
          observedCount: timeline && !this.localEmpty ? this.#observedAt(entry, timeline.observationTime, timeMode).length : 0 };
      }),
    };
  }
  play() { this.timeline?.play(); }
  pause() { this.timeline?.pause(); }
  toggle() { this.timeline?.toggle(); }
  seek(time) { this.timeline?.seek(time); }
  seekObservation(index) { this.timeline?.seekObservation(index); }
  nextObservation() { this.timeline?.nextObservation(); }
  previousObservation() { this.timeline?.previousObservation(); }
  setRate(rate) {
    this.timeline?.setRate(rate);
    if (this.spec) this.spec.cinematic.clock.rate = this.timeline?.state().playbackRate ?? this.spec.cinematic.clock.rate;
  }
  setTimeMode(timeMode) {
    if (!this.spec) return;
    this.spec.cinematic.clock.timeMode = timeMode === "cumulative" ? "cumulative" : "instant";
    const snapshot = this.timeline?.state();
    if (snapshot) this.#render(snapshot);
  }
  setIntent(intent) {
    if (!this.spec) return;
    this.spec.cinematic.intent = ["explore", "investigate", "present"].includes(intent) ? intent : "explore";
    this.onState(this.state());
  }
  setLocalWindow(enabled) {
    this.localWindow = enabled === true;
    return this.refreshLocalWindow();
  }
  refreshLocalWindow() {
    if (!this.spec) return false;
    if (!this.localWindow) {
      this.localModels.clear(); this.localEmpty = false; this.#resetTimeline(); return true;
    }
    const extent = this.mapController.getViewExtent?.();
    if (!extent) return false;
    this.localModels = new Map([...this.layers.values()].map(({ layer, model }) => [layer.uid, temporalModelInExtent(model, extent)]));
    const ticks = [...new Set([...this.localModels.values()].flatMap((model) => model.ticks))];
    this.localEmpty = !ticks.length;
    if (ticks.length) this.#resetTimeline(ticks);
    else {
      this.renderedObservationTime = null;
      this.renderedTimeMode = null;
      const snapshot = this.timeline?.state();
      if (snapshot) this.#render(snapshot);
    }
    return !this.localEmpty;
  }
  /**
   * Plays only observations from `start` to `end` (ISO strings, epoch ms or
   * empty for "from the first" / "to the last"). Keeps the current moment when
   * it is inside the new range. Throws when the range is backwards or empty.
   */
  setPlaybackRange(start, end) {
    if (!this.spec) return false;
    const read = (value) => (value === "" || value == null ? NaN : typeof value === "number" ? value : this.#bound(value));
    const from = read(start), to = read(end);
    if (Number.isFinite(from) && Number.isFinite(to) && to < from) throw new Error("The end date must be after the start date.");
    const all = this.#allTicks();
    if (!all.some((tick) => (!Number.isFinite(from) || tick >= from) && (!Number.isFinite(to) || tick <= to))) throw new Error("No observations fall between those dates.");
    const current = this.timeline?.state().observationTime;
    const store = (value) => (!Number.isFinite(value) ? "" : this.valueKind() === "number" ? String(value) : new Date(value).toISOString());
    this.spec.cinematic.clock.start = store(from);
    this.spec.cinematic.clock.end = store(to);
    this.#resetTimeline(this.localWindow && !this.localEmpty ? all : null);
    if (Number.isFinite(current) && (!Number.isFinite(from) || current >= from) && (!Number.isFinite(to) || current <= to)) this.timeline.seek(current);
    return true;
  }

  /** How playback steps: "time" (a date field), "number" (a Scenario sweep) or "none" (Ambient). */
  valueKind() {
    if (!this.spec) return "time";
    // The first stepping track leads; a scene of only Ambient tracks has no timeline.
    return this.spec.cinematic.layers.find((config) => config.temporal.kind !== "none")?.temporal.kind || (this.spec.cinematic.layers.length ? "none" : "time");
  }

  /** A range bound or a go-to value as a playback value of this session's kind (NaN when empty). */
  #bound(value) {
    if (value === "" || value == null) return NaN;
    const parsed = parsePlaybackValue(value, this.valueKind());
    return parsed == null ? NaN : parsed;
  }

  /** Every observation time (in the local window when it is on), ignoring the playback range. */
  #allTicks() {
    return [...new Set([...this.layers.values()].filter((entry) => !this.#ambient(entry)).flatMap(({ layer, model }) => (this.localModels.get(layer.uid) || model).ticks))].sort((a, b) => a - b);
  }

  /** Shows the latest observation on or before `time`; returns that observation's time. */
  goToTime(time) {
    const value = typeof time === "number" ? time : this.#bound(time);
    if (!this.timeline || !Number.isFinite(value)) return null;
    this.timeline.seek(value);
    return this.timeline.state().observationTime;
  }

  setBoundaryGlow(enabled) { this.setEffect(enabled === true ? "glow" : "none"); }
  /** The decorative effect for every cinematic layer: a CINEMATIC_EFFECTS key or "auto". */
  /** Effect detail: "auto", "eco", "balanced" or "cinematic". */
  setQuality(quality) {
    if (!this.spec) return;
    this.spec.cinematic.quality = TIERS.includes(quality) ? quality : "auto";
    this.adaptive = { cap: TIERS.length - 1, slow: 0 };
    this.#readStats({ reset: true });
    this.refreshEffectDetail();
  }

  /** The effect for every track, or for one track when `layerUid` is given. */
  setEffect(type, layerUid = null) {
    if (!this.spec) return;
    const only = layerUid ? this.layers.get(layerUid)?.config : null;
    // A Strata timeline is a build-up: earlier records stay below as later ones land on top.
    if (type === "strata") this.spec.cinematic.clock.timeMode = "cumulative";
    for (const layer of this.spec.cinematic.layers) {
      if (only && layer !== only) continue;
      layer.animation.effect = { ...layer.animation.effect, type: type === "auto" || CINEMATIC_EFFECTS[type] ? type : "none" };
      layer.animation.outline = { color: layer.animation.outline?.color || "#ff8136", glow: layer.animation.effect.type !== "none" };
    }
    // Effects use the same observation snapshot, so deliberately invalidate the
    // render cache when their setting changes at a paused observation.
    this.renderedObservationTime = null;
    this.renderedTimeMode = null;
    const snapshot = this.timeline?.state();
    if (snapshot) this.#render(snapshot);
  }
  /* ---- The master effects clock (animation time, not observation dates) ---- */

  /** Effects move (true) or hold still (false); the timeline is separate. */
  setEffectsPlaying(playing) {
    if (!this.effectsClock || !this.spec) return;
    if (playing) this.effectsClock.play(); else this.effectsClock.pause();
    this.spec.cinematic.clock.effectsPlaying = this.effectsClock.playing;
    this.#repaint();
  }
  toggleEffects() { this.setEffectsPlaying(!this.effectsClock?.playing); }
  /** Every track shows its state at master time `seconds`, playing or not. */
  seekEffects(seconds) { this.effectsClock?.seek(seconds); this.#repaint(); }
  setEffectsRate(rate) {
    if (!this.effectsClock || !this.spec) return;
    this.effectsClock.setRate(rate);
    this.spec.cinematic.clock.effectsRate = this.effectsClock.rate;
    this.#repaint();
  }

  /* ---- Per-track settings ---- */

  /** A track's motion on the master clock: { rate, cycleSeconds, offsetSeconds, policy }. */
  setTrackTiming(layerUid, timing) {
    const entry = this.layers.get(layerUid);
    if (!entry) return;
    entry.config.animation.timing = normalizeTiming({ ...entry.config.animation.timing, ...timing });
    this.#redrawTrack(entry);
  }
  /** Show or hide a track's effect; its records stay filtered as before. */
  setTrackVisible(layerUid, visible) {
    const entry = this.layers.get(layerUid);
    if (!entry) return;
    entry.config.animation.visible = visible !== false;
    this.#redrawTrack(entry);
  }
  /** A track's effect colour (#rrggbb), or null for the effect's own. */
  setTrackColor(layerUid, color) {
    const entry = this.layers.get(layerUid);
    if (!entry) return;
    entry.config.animation.effect = { ...entry.config.animation.effect, color: /^#[0-9a-f]{6}$/i.test(color || "") ? color : null };
    this.#redrawTrack(entry);
  }
  /** What the track's progression is: observed, interpolated, modeled, forecast or illustrative. */
  setTrackProvenance(layerUid, status) {
    const entry = this.layers.get(layerUid);
    if (!entry || !PROVENANCE_STATUSES.includes(status)) return;
    entry.config.provenance = { ...entry.config.provenance, status };
    this.onState(this.state());
  }

  #redrawTrack(entry) {
    entry.settled = null; entry.ambientKey = null;
    this.renderedObservationTime = null;
    const snapshot = this.timeline?.state();
    if (snapshot) this.#render(snapshot); else this.onState(this.state());
  }

  /** Effects stop repainting while their clock is paused, so a change needs one frame drawn. */
  #repaint() {
    try { this.mapController.requestEffectFrame?.(); } catch { /* no effects on this engine */ }
    this.onState(this.state());
  }

  async setLayerOpacity(opacity) {
    if (!this.spec) return;
    const next = Math.min(1, Math.max(0.05, Number(opacity) || 1));
    await Promise.all([...this.layers.values()].map(async ({ layer, config }) => {
      config.animation.opacity = next;
      await attempt(() => this.mapController.setOpacity(layer.uid, next), false);
    }));
    this.onState(this.state());
  }
  async focusCurrentObservation({ animate = true } = {}) {
    const snapshot = this.timeline?.state();
    if (!snapshot || typeof this.mapController.goToFeatures !== "function") return false;
    const timeMode = this.spec?.cinematic.clock.timeMode || "instant";
    const features = [...this.layers.values()].filter((entry) => !this.#ambient(entry)).flatMap((entry) => this.#observedAt(entry, snapshot.observationTime, timeMode)
      .map((observation) => observation.feature)
      .filter((feature) => feature?.geometry));
    return features.length ? attempt(() => this.mapController.goToFeatures(features, { animate }), false) : false;
  }
  exportCinematicSpec() { return exportCinematicSpec(this.spec); }

  /**
   * The effect each track shows, to keep on its layer (Advanced Style) after
   * leaving Cinematic mode: [{ uid, title, effect: { type, intensity, color } }].
   * Tracks without an effect are left out, so their layers keep their own.
   */
  effectsToKeep() {
    return [...this.layers.values()].flatMap(({ layer, config }) => {
      const type = this.#effectFor(layer, config);
      if (!type || type === "none") return [];
      const { intensity = 1, color = null } = config.animation.effect || {};
      return [{ uid: layer.uid, title: layer.title, effect: { type, intensity, color } }];
    });
  }

  async destroy() {
    if (this.effectsClock) { setEffectClock(null); this.effectsClock = null; }
    this.unsubscribe?.(); this.unsubscribe = null;
    this.timeline?.destroy(); this.timeline = null;
    this.pendingSnapshot = null;
    await this.renderTask?.catch(() => {});
    this.renderTask = null;
    await Promise.all([...this.layers.values()].map((entry) => this.#restoreLayer(entry)));
    this.layers.clear(); this.localModels.clear(); this.localWindow = false; this.localEmpty = false; this.spec = null; this.renderedObservationTime = null; this.renderedTimeMode = null;
  }

  /**
   * Every record of the layer, oldest first, one page at a time: a single
   * page of a newest-first feed would start playback days after the data
   * does. Bounded so a huge service cannot exhaust memory.
   */
  async #queryAll(layer, timeField) {
    const pageSize = Math.min(layer.maxRecordCount || 2000, 5000);
    const order = [...(timeField ? [`${timeField} ASC`] : []), ...(layer.objectIdField ? [`${layer.objectIdField} ASC`] : [])];
    const features = [];
    for (let start = 0; ; start += pageSize) {
      const page = await this.mapController.queryFeatures(layer.uid, {
        where: layer.where || "1=1", outFields: ["*"], returnGeometry: true, start, num: pageSize, orderByFields: order,
      });
      features.push(...(page.features || []));
      // Services without pagination ignore `start`; one page is all they give.
      const more = page.exceededTransferLimit === true && page.features?.length > 0 && layer.supportsPagination !== false;
      if (!more) return { features, truncated: false };
      if (features.length >= MAX_FEATURES) return { features, truncated: true };
    }
  }

  /**
   * Draws a layer's effect for one snapshot. "Fresh" records (first observed
   * at this tick) flare as they appear. A large build-up is split into a
   * settled layer (older outlines, edge only, rebuilt occasionally) and a
   * recent layer (the newest, full detail, rebuilt each step).
   */
  async #drawEffects(entry, { effect, observations, observationTime, timeMode, effectRange }) {
    const { layer, config, effectUid } = entry;
    const quality = this.#quality(observations.length);
    const base = { type: "observed-effect", effect, color: config.animation.effect?.color || null, intensity: config.animation.effect?.intensity ?? 1, opacity: config.animation.effect?.opacity ?? 1, style: config.animation.effect?.style || "balanced", speed: config.animation.effect?.speed ?? 1, density: config.animation.effect?.density ?? 1, field: config.animation.effect?.field || null, fields: layer.fields || [], ranges: effectRange, timing: config.animation.timing };
    const asItems = (list) => list.map((observation) => ({ feature: observation.feature, fresh: observation.time === observationTime }));
    if (effect === "strata") {
      // Every record is sent once (`stack`, its slots fixed by the whole timeline); each step only says which show.
      entry.settled = null;
      await attempt(() => this.mapController.clearCinematicEffect?.(`${effectUid}:settled`), false);
      await attempt(() => this.mapController.setCinematicEffect(effectUid, { ...base, layerUid: layer.uid, chart: layer.spatialChart || null, ticks: entry.model.ticks, stack: entry.model.observations,
        items: observations.map((observation) => ({ index: observation.index, fresh: observation.time === observationTime })) }), false);
      return;
    }
    // Native effects (Rise, Reveal) are style layers, cheap at any size: no settled/recent split.
    const split = !NATIVE_EFFECTS.includes(effect) && timeMode === "cumulative" && observations.length > RECENT_MIN * 2;
    if (!split) {
      entry.settled = null;
      await attempt(() => this.mapController.clearCinematicEffect?.(`${effectUid}:settled`), false);
      await attempt(() => this.mapController.setCinematicEffect(effectUid, { ...base, quality, items: asItems(observations) }), false);
      return;
    }
    const zoom = Math.round(this.mapController.getViewState?.()?.zoom ?? 0);
    const settled = entry.settled;
    const recentCount = settled ? observations.filter((observation) => observation.time > settled.time).length : Infinity;
    const due = !settled || observationTime <= settled.time || settled.zoom !== zoom || settled.effect !== effect || settled.quality !== quality
      || recentCount > RECENT_MIN * 2;
    if (due) {
      // Settle everything before this tick except the newest RECENT_MIN records.
      const older = observations.filter((observation) => observation.time < observationTime).sort((a, b) => a.time - b.time);
      const cut = older[Math.max(0, older.length - RECENT_MIN) - 1]?.time ?? -Infinity;
      const settledItems = older.filter((observation) => observation.time <= cut);
      entry.settled = { time: cut, count: settledItems.length, zoom, effect, quality };
      await attempt(() => this.mapController.setCinematicEffect(`${effectUid}:settled`, { ...base, quality: "eco", settled: true, items: settledItems.map((observation) => ({ feature: observation.feature, fresh: false })) }), false);
    }
    const recent = observations.filter((observation) => observation.time > entry.settled.time);
    await attempt(() => this.mapController.setCinematicEffect(effectUid, { ...base, quality: quality === "eco" ? "eco" : "cinematic", items: asItems(recent) }), false);
  }

  /** The detail tier for a scene of `count` records: the chosen one, or Auto's pick capped by measured frame time. */
  #quality(count) {
    const chosen = this.spec?.cinematic.quality || "auto";
    const tier = resolveQuality(chosen, count);
    return chosen === "auto" ? TIERS[Math.min(TIERS.indexOf(tier), this.adaptive.cap)] : tier;
  }

  #readStats({ reset = false } = {}) {
    try { return this.mapController.getCinematicEffectStats?.({ reset }) ?? null; } catch { return null; }
  }

  /** After a playback step: note frame time and, on Auto, lighten effects when playback can't keep up. */
  #adapt(playing) {
    const stats = this.#readStats();
    this.effectStats = stats;
    if (!playing || (this.spec?.cinematic.quality || "auto") !== "auto" || !stats?.samples || stats.samples < 30 || this.adaptive.cap === 0) return;
    this.adaptive.slow = stats.frameMs > SLOW_FRAME_MS ? this.adaptive.slow + 1 : 0;
    if (this.adaptive.slow < SLOW_STEPS) return;
    // The next step draws at the lighter tier; settled layers re-settle because their tier changed.
    this.adaptive = { cap: this.adaptive.cap - 1, slow: 0 };
    this.#readStats({ reset: true });
  }

  /** A new zoom level changes how much detail effects need; redraw the current snapshot. */
  refreshEffectDetail() {
    if (!this.spec || !this.timeline) return;
    this.renderedObservationTime = null;
    this.#render(this.timeline.state());
  }

  #effectFor(layer, config) {
    const type = config.animation?.effect?.type || "none";
    if (type === "none" || config.animation?.visible === false) return "none";
    return resolveEffect(type, { title: layer.title, geometryType: layer.geometryType, fields: layer.fields || [] });
  }

  #resetTimeline(explicitTicks = null) {
    const previous = this.timeline?.state();
    const wasPlaying = previous?.playing === true;
    this.unsubscribe?.(); this.unsubscribe = null;
    this.timeline?.destroy();
    const allTicks = explicitTicks || this.#allTicks();
    // A Clip's range limits playback to its observations (an empty range is the whole layer).
    const from = this.#bound(this.spec.cinematic.clock.start), to = this.#bound(this.spec.cinematic.clock.end);
    const inRange = allTicks.filter((tick) => (!Number.isFinite(from) || tick >= from) && (!Number.isFinite(to) || tick <= to));
    const ticks = inRange.length ? inRange : allTicks;
    this.timeline = createCinematicTimeline({ ticks, durationSeconds: this.spec.cinematic.clock.durationSeconds, rate: this.spec.cinematic.clock.rate, loop: this.spec.cinematic.clock.loop, reducedMotion: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches });
    this.renderedObservationTime = null;
    this.renderedTimeMode = null;
    // A new timeline (range, local window) has a different set of records to settle.
    for (const entry of this.layers.values()) { entry.settled = null; entry.ambientKey = null; }
    this.unsubscribe = this.timeline.subscribe((snapshot) => this.#render(snapshot));
    if (wasPlaying) this.timeline.play();
  }

  async #render(snapshot) {
    this.pendingSnapshot = snapshot;
    if (this.renderTask) return this.renderTask;
    this.renderTask = (async () => {
      while (this.pendingSnapshot) {
        const next = this.pendingSnapshot;
        this.pendingSnapshot = null;
        const timeMode = this.spec?.cinematic.clock.timeMode || "instant";
        if (next.observationTime !== this.renderedObservationTime || timeMode !== this.renderedTimeMode) {
          await Promise.all([...this.layers.values()].map(async (entry) => {
            const { layer, config, effectUid, effectRange } = entry;
            const ambient = this.#ambient(entry);
            const effect = this.#effectFor(layer, config);
            // An Ambient track doesn't change from step to step; redraw it only when its look does.
            const ambientKey = ambient ? `${effect}|${this.#quality(entry.model.observations.length)}|${Math.round(this.mapController.getViewState?.()?.zoom ?? 0)}|${this.localEmpty}|${this.localModels.get(layer.uid)?.observations.length ?? "all"}` : null;
            if (ambient && entry.ambientKey === ambientKey) return;
            entry.ambientKey = ambientKey;
            const observations = this.localEmpty ? [] : this.#observedAt(entry, next.observationTime, timeMode);
            await this.mapController.setFeatureFilter(layer.uid, { objectIds: uniqueIds(observations) });
            if (typeof this.mapController.setCinematicEffect === "function" && effect !== "none") {
              await this.#drawEffects(entry, { effect, observations, observationTime: ambient ? null : next.observationTime, timeMode: ambient ? "instant" : timeMode, effectRange });
            } else if (typeof this.mapController.clearCinematicEffect === "function") {
              await attempt(() => this.mapController.clearCinematicEffect(effectUid), false);
              await attempt(() => this.mapController.clearCinematicEffect(`${effectUid}:settled`), false);
              this.layers.get(layer.uid).settled = null;
            }
          }));
          this.renderedObservationTime = next.observationTime;
          this.renderedTimeMode = timeMode;
          this.#adapt(next.playing === true);
        }
        this.onState(this.state());
      }
    })().finally(() => { this.renderTask = null; });
    return this.renderTask;
  }
}
