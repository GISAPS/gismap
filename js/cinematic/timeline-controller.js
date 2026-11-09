import { createAnimationClock } from "../animation-clock.js?v=0.1.0";
import { nearestObservationIndex } from "./temporal-adapter.js?v=0.4.0-sequence";

/** A shared clock with uniform observed-step playback, independent of date gaps. */
export function createCinematicTimeline({ ticks = [], durationSeconds = 120, rate = 0.25, loop = false, reducedMotion = false, clockFactory = createAnimationClock } = {}) {
  const orderedTicks = [...new Set(ticks.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!orderedTicks.length) throw new Error("Cinematic playback needs at least one valid observation.");
  const start = orderedTicks[0];
  const end = orderedTicks.at(-1);
  const duration = Math.min(600, Math.max(1, Number(durationSeconds) || 120));
  const positionEnd = Math.max(1, orderedTicks.length - 1);
  let playbackRate = Math.min(4, Math.max(0.1, Number(rate) || 0.25));
  const baseSpeed = positionEnd / (duration * 1000);
  // The animation clock tracks observation positions, not elapsed calendar
  // milliseconds. A month-long quiet period therefore never makes a later
  // burst of closely spaced observations flicker past in a few frames.
  const clock = clockFactory({ start: 0, end: positionEnd, speed: baseSpeed * playbackRate, loop, reducedMotion });
  const listeners = new Set();
  const state = () => {
    const position = Math.min(positionEnd, Math.max(0, clock.time));
    const observationIndex = Math.min(orderedTicks.length - 1, Math.floor(position));
    return { ...clock.state(), time: orderedTicks[observationIndex], start, end, ticks: orderedTicks, observationIndex, observationTime: orderedTicks[observationIndex], playbackRate };
  };
  const emit = () => listeners.forEach((listener) => listener(state()));
  const stop = clock.onTick(emit);
  const api = {
    state,
    play: () => { if (start !== end) clock.play(); return api; },
    pause: () => { clock.pause(); return api; },
    toggle: () => (clock.playing ? clock.pause() : clock.play()),
    seek: (time) => { clock.seek(nearestObservationIndex(orderedTicks, Number(time))); return api; },
    seekObservation: (index) => {
      const tick = orderedTicks[Math.max(0, Math.min(orderedTicks.length - 1, Number(index) || 0))];
      clock.seek(orderedTicks.indexOf(tick));
      return api;
    },
    nextObservation: () => { const current = state().observationIndex; return api.seekObservation(Math.min(orderedTicks.length - 1, current + 1)); },
    previousObservation: () => { const current = state().observationIndex; return api.seekObservation(Math.max(0, current - 1)); },
    setRate: (rate) => { playbackRate = Math.min(4, Math.max(0.1, Number(rate) || 0.25)); clock.setSpeed(baseSpeed * playbackRate); emit(); return api; },
    setLoop: (value) => { clock.setLoop(value); return api; },
    subscribe: (listener) => { listeners.add(listener); listener(state()); return () => listeners.delete(listener); },
    destroy: () => { stop(); listeners.clear(); clock.destroy(); },
  };
  return api;
}
