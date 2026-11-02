// A playback clock owned by GISMap Online, not by a map engine: engines and layers read
// `time` each frame, so an animation means the same thing on every engine.
// `now` and `requestFrame` are injectable for tests.

export function createAnimationClock({ start = 0, end = 10000, speed = 1, loop = false, now = () => performance.now(), requestFrame = (callback) => requestAnimationFrame(callback), cancelFrame = (id) => cancelAnimationFrame(id), reducedMotion = false } = {}) {
  if (!(Number.isFinite(start) && Number.isFinite(end) && end > start)) throw new Error("The animation needs a start before its end.");
  const listeners = new Set();
  let time = start, playing = false, last = 0, frame = null;
  const clamp = (value) => Math.min(end, Math.max(start, value));
  const emit = () => listeners.forEach((listener) => listener(clock.state()));
  const tick = () => {
    frame = null;
    if (!playing) return;
    const current = now();
    let next = time + (current - last) * speed;
    last = current;
    if (next >= end || next < start) {
      if (loop) next = speed >= 0 ? start + ((next - start) % (end - start)) : end - ((start - next) % (end - start));
      else { next = speed >= 0 ? end : start; playing = false; }
    }
    time = next;
    emit();
    if (playing) frame = requestFrame(tick);
  };
  const clock = {
    get time() { return time; },
    get playing() { return playing; },
    state: () => ({ time, progress: (time - start) / (end - start), playing, speed, start, end }),
    /** With reduced motion the clock jumps to the end instead of animating. */
    play() {
      if (reducedMotion) { time = end; emit(); return clock; }
      if (playing) return clock;
      if (!loop && (speed >= 0 ? time >= end : time <= start)) time = speed >= 0 ? start : end;
      playing = true;
      last = now();
      frame = requestFrame(tick);
      return clock;
    },
    pause() { playing = false; if (frame != null) cancelFrame(frame); frame = null; emit(); return clock; },
    seek(value) { time = clamp(Number(value)); last = now(); emit(); return clock; },
    setSpeed(value) { if (!Number.isFinite(Number(value)) || Number(value) === 0) throw new Error("Choose a nonzero speed."); speed = Math.max(-16, Math.min(16, Number(value))); return clock; },
    setLoop(value) { loop = Boolean(value); return clock; },
    onTick(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    destroy() { clock.pause(); listeners.clear(); },
  };
  return clock;
}
