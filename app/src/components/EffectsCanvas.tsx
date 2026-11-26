// SpectreScan — the effects layer: one canvas over the whole page.
// Sakuga architecture, Kiro styling. A single fixed canvas draws
// drifting ectoplasm mist, slow particles, and a sheet ghost that
// floats and leans slightly toward the mouse. Every colour is read
// from the page CSS variables, so the palette lives in globals.css.
// Cheap on purpose: one requestAnimationFrame, about 60 particles,
// no images, no external assets. Fully off under
// prefers-reduced-motion (one static frame, no loop). Listens for a
// "spectre:burst" window event and fires a particle burst, which the
// scan report triggers when a verdict lands.

"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  sway: number;
  phase: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface Mist {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return [167, 139, 250];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export default function EffectsCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const style = getComputedStyle(document.documentElement);
    const varColor = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    const spectral = hexToRgb(varColor("--color-spectral", "#a78bfa"));
    const ecto = hexToRgb(varColor("--color-ectoplasm", "#7fe0b2"));
    const ember = hexToRgb(varColor("--color-ember", "#f0a35e"));
    const blood = hexToRgb(varColor("--color-blood", "#f26d6d"));

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const rgba = (c: [number, number, number], a: number) =>
      `rgba(${c[0]},${c[1]},${c[2]},${a})`;

    const palette: Array<[number, number, number]> = [
      spectral,
      spectral,
      ecto,
      ember,
    ];
    const particles: Particle[] = [];
    const spawnAmbient = () => {
      for (let i = 0; i < 55; i++) {
        const c = palette[i % palette.length];
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.6 + Math.random() * 1.6,
          vx: (Math.random() - 0.5) * 0.08,
          vy: -(0.05 + Math.random() * 0.16),
          sway: 0.2 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
          color: `rgba(${c[0]},${c[1]},${c[2]},`,
          alpha: 0.25 + Math.random() * 0.45,
          life: Infinity,
          maxLife: Infinity,
        });
      }
    };
    spawnAmbient();

    const mists: Mist[] = [
      { x: 0.22, y: 0.16, r: 0.42, vx: 0.00004, vy: 0.00002, color: "spectral", alpha: 0.05 },
      { x: 0.78, y: 0.3, r: 0.36, vx: -0.00003, vy: 0.00003, color: "ecto", alpha: 0.04 },
      { x: 0.5, y: 0.85, r: 0.5, vx: 0.00002, vy: -0.00002, color: "spectral", alpha: 0.04 },
      { x: 0.1, y: 0.6, r: 0.3, vx: 0.00005, vy: 0.00001, color: "ember", alpha: 0.03 },
    ];
    const mistColor = (name: string) =>
      name === "ecto" ? ecto : name === "ember" ? ember : spectral;

    // The ghost: a sheet silhouette, upper right of the hero, floating
    // on a sine bob and leaning a few pixels toward the mouse.
    const ghost = { x: 0.74, y: 0.2, bob: 0, lean: 0 };
    const mouse = { x: 0.5, y: 0.5 };
    const onMouse = (e: MouseEvent) => {
      mouse.x = e.clientX / Math.max(w, 1);
      mouse.y = e.clientY / Math.max(h, 1);
    };
    window.addEventListener("mousemove", onMouse);

    const onBurst = () => {
      const cx = w * 0.5;
      const cy = h * 0.32;
      const burstColors = [spectral, ecto, ember, blood];
      for (let i = 0; i < 70; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.6 + Math.random() * 3.2;
        const c = burstColors[i % burstColors.length];
        particles.push({
          x: cx + (Math.random() - 0.5) * 60,
          y: cy + (Math.random() - 0.5) * 30,
          r: 1 + Math.random() * 2.2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.4,
          sway: 0,
          phase: 0,
          color: `rgba(${c[0]},${c[1]},${c[2]},`,
          alpha: 0.9,
          life: 0,
          maxLife: 55 + Math.random() * 40,
        });
      }
    };
    window.addEventListener("spectre:burst", onBurst);

    const drawGhost = (t: number) => {
      const gx = w * ghost.x + ghost.lean;
      const gy = h * ghost.y + Math.sin(t * 0.0006) * 10;
      const s = Math.min(w, 1100) / 1100; // scale with viewport
      const gw = 92 * s;
      const gh = 118 * s;
      ctx.save();
      ctx.translate(gx, gy);
      const grad = ctx.createLinearGradient(0, -gh / 2, 0, gh / 2);
      grad.addColorStop(0, rgba(spectral, 0.16));
      grad.addColorStop(1, rgba(spectral, 0.05));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-gw / 2, gh / 2);
      ctx.lineTo(-gw / 2, -gh * 0.1);
      ctx.bezierCurveTo(-gw / 2, -gh / 2, -gw * 0.2, -gh / 2, 0, -gh / 2);
      ctx.bezierCurveTo(gw * 0.2, -gh / 2, gw / 2, -gh / 2, gw / 2, -gh * 0.1);
      ctx.lineTo(gw / 2, gh / 2);
      // Wavy skirt: three scallops.
      const step = gw / 3;
      for (let i = 0; i < 3; i++) {
        const x0 = gw / 2 - step * i;
        const x1 = gw / 2 - step * (i + 1);
        ctx.quadraticCurveTo((x0 + x1) / 2, gh / 2 - 14 * s, x1, gh / 2);
      }
      ctx.closePath();
      ctx.fill();
      // No face: the sheet is a wisp, not a cartoon ghost. Eyes and a
      // mouth read as clip-art against the spectral core beside it.
      ctx.restore();
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      // Mist blobs.
      for (const m of mists) {
        const mx = m.x * w;
        const my = m.y * h;
        const mr = m.r * Math.max(w, h);
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
        const c = mistColor(m.color);
        g.addColorStop(0, rgba(c, m.alpha));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
      }
      // Particles.
      for (const p of particles) {
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      drawGhost(t);
    };

    const step = (t: number) => {
      for (const m of mists) {
        m.x += m.vx;
        m.y += m.vy;
        if (m.x < -0.1 || m.x > 1.1) m.vx = -m.vx;
        if (m.y < -0.1 || m.y > 1.1) m.vy = -m.vy;
      }
      ghost.lean += (mouse.x - 0.5) * 26 - ghost.lean * 0.04;
      ghost.lean *= 0.96;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.life !== Infinity) {
          p.life += 1;
          if (p.life >= p.maxLife) {
            particles.splice(i, 1);
            continue;
          }
          p.alpha = 0.9 * (1 - p.life / p.maxLife);
          p.vy += 0.02;
        }
        p.x += p.vx + Math.sin(t * 0.001 + p.phase) * 0.08 * p.sway;
        p.y += p.vy;
        if (p.life === Infinity) {
          if (p.y < -4) {
            p.y = h + 4;
            p.x = Math.random() * w;
          }
          if (p.x < -4) p.x = w + 4;
          if (p.x > w + 4) p.x = -4;
        }
      }
      draw(t);
    };

    if (reduced) {
      // One static frame, no loop: the mist and the ghost are still
      // there, nothing moves.
      draw(0);
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("mousemove", onMouse);
        window.removeEventListener("spectre:burst", onBurst);
      };
    }

    let raf = 0;
    const loop = (t: number) => {
      if (!document.hidden) step(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("spectre:burst", onBurst);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1]"
    />
  );
}
