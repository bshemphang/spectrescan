// SpectreScan — verdict sound: a soft WebAudio chime on verdict
// reveal. No audio files. Off by default; the toggle in the header
// persists the choice in localStorage. Sound is a nicety: every call
// is wrapped so a blocked AudioContext never breaks the page.

const KEY = "spectrescan:sound";

export function isSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage unavailable: the toggle still works for this session.
  }
}

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

// Two soft sine notes (C5 then G5) under a breath of filtered noise:
// a whisper, not an alarm. Total length about 1.4 seconds. The master
// peaks at 0.22: the old 0.05 peak was near inaudible on phone
// speakers, which is why the toggle seemed dead. Still soft, and the
// toggle always plays a preview when turned on, so the control is
// never silent.
export function playVerdictChime(): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    const master = ac.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    master.connect(ac.destination);
    for (const [freq, at] of [
      [523.25, 0],
      [783.99, 0.14],
    ] as const) {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.5, now + at);
      g.gain.exponentialRampToValueAtTime(0.001, now + at + 1.1);
      osc.connect(g);
      g.connect(master);
      osc.start(now + at);
      osc.stop(now + at + 1.2);
    }
    const len = Math.floor(ac.sampleRate * 0.9);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1200;
    band.Q.value = 1.5;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.12, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    noise.connect(band);
    band.connect(ng);
    ng.connect(master);
    noise.start(now);
  } catch {
    // Audio is decorative; never let it throw.
  }
}
