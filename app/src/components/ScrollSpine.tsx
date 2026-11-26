// SpectreScan — scroll spine: a thin progress line fixed to the left
// edge on wide screens, with a marker per act of the home page. The
// active marker follows the act in view. Desktop only; the acts are
// still reachable by normal scrolling everywhere.

"use client";

import { useEffect, useState } from "react";

const ACTS = [
  { id: "act-scan", label: "Scan" },
  { id: "act-cases", label: "Cases" },
  { id: "act-autopsy", label: "Autopsy" },
  { id: "act-lab", label: "Lab" },
];

export default function ScrollSpine() {
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(ACTS[0].id);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
      let current = ACTS[0].id;
      for (const act of ACTS) {
        const el = document.getElementById(act.id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) {
          current = act.id;
        }
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Page sections"
      className="fixed top-1/2 left-5 z-20 hidden -translate-y-1/2 lg:block"
    >
      <div className="relative flex flex-col gap-5">
        <span
          aria-hidden
          className="absolute top-0 left-[5px] w-px bg-white/15"
          style={{ height: "100%" }}
        />
        <span
          aria-hidden
          className="absolute top-0 left-[5px] w-px bg-spectral transition-[height] duration-150"
          style={{ height: `${progress * 100}%` }}
        />
        {ACTS.map((act) => (
          <a
            key={act.id}
            href={`#${act.id}`}
            className="group relative flex items-center gap-3 pl-5"
            aria-current={active === act.id ? "true" : undefined}
          >
            <span
              aria-hidden
              className={`absolute left-0 h-[11px] w-[11px] rounded-full border transition-colors ${
                active === act.id
                  ? "border-spectral bg-spectral"
                  : "border-white/30 bg-haunt-bg group-hover:border-spectral"
              }`}
            />
            <span
              className={`font-mono text-[11px] tracking-wide transition-colors ${
                active === act.id ? "text-bone" : "text-bone-dim"
              }`}
            >
              {act.label}
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}
