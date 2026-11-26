// SpectreScan — verdict sound toggle in the header. Off by default.
// Turning it on plays one short chime so the choice is audible, and
// the AudioContext is created inside the click, which browsers allow.

"use client";

import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  isSoundEnabled,
  playVerdictChime,
  setSoundEnabled,
} from "@/lib/sound";

export default function SoundToggle() {
  const [on, setOn] = useState(() => isSoundEnabled());

  function toggle() {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    if (next) playVerdictChime();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Turn verdict sound off" : "Turn verdict sound on"}
      title={on ? "Verdict sound on" : "Verdict sound off"}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-bone-dim transition-[background-color,border-color,color] hover:border-white/30 hover:bg-white/[0.04] hover:text-bone focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-spectral"
    >
      {on ? (
        <Volume2 size={16} strokeWidth={1.5} aria-hidden />
      ) : (
        <VolumeX size={16} strokeWidth={1.5} aria-hidden />
      )}
    </button>
  );
}
