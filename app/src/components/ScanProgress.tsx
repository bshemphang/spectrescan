// SpectreScan — scan progress: a staged phase indicator shown while a
// scan runs. The phases run in this order on the server; the indicator is
// timed, not server-driven, because the engine does not stream progress.
// It is honest about what it is: it says what the scan is doing, never
// how far along it is.

"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const STEPS = [
  "Reading verified source",
  "Checking the owner",
  "Checking the liquidity lock",
  "Checking the holders",
  "Writing the ghost's verdict",
];

export default function ScanProgress({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) return;
    // Step starts at 0 (initial state); the parent remounts this
    // component for each new scan, so no reset is needed here.
    const id = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 3500);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div aria-live="polite" className="mx-auto mt-8 max-w-md">
      <ol className="space-y-3">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex items-center gap-3 text-sm">
              {done ? (
                <CheckCircle2
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 text-spectral"
                  aria-hidden
                />
              ) : current ? (
                <Loader2
                  size={16}
                  strokeWidth={1.5}
                  className="shrink-0 animate-spin text-spectral"
                  aria-hidden
                />
              ) : (
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-white/20"
                  aria-hidden
                />
              )}
              <span className={done || current ? "text-bone" : "text-bone-dim"}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-center text-xs text-bone-dim">
        A full scan usually takes under 10 seconds.
      </p>
    </div>
  );
}
