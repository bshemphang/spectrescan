// SpectreScan — the spectral core: a detailed 3D model, not a blob.
// Layered translucent outer shells, an inner glowing core, a particle
// field inside the core, a wireframe inner cage, and three thin
// orbiting rings. Every layer is a different material and colour, so
// the inside is as detailed as the outside. Drag to rotate, slight
// mouse parallax, and the colours shift with the score band:
// Resting green, Mildly haunted amber, Haunted orange-red, Possessed
// violet.
//
// Performance is part of the design: all basic materials (no lights,
// no shadows), low geometry counts, devicePixelRatio capped at 1.75,
// rendering pauses when the core scrolls offscreen, and Three.js is
// lazy-loaded after mount so the first paint never waits for it.
// Under prefers-reduced-motion it renders one static frame and stops.

"use client";

import { useEffect, useRef, useState } from "react";
import type { Color, Mesh, MeshBasicMaterial } from "three";
import type { RiskBand } from "@/lib/engine/types";

// Band colours for the core. Deliberately not the meter palette:
// the core is a second voice, and the brief fixes this mapping.
const BAND_COLORS: Record<RiskBand, { core: string; shell: string }> = {
  "Resting in peace": { core: "#7fe0b2", shell: "#a78bfa" },
  "Mildly haunted": { core: "#e8c85a", shell: "#a78bfa" },
  Haunted: { core: "#f0784a", shell: "#f26d6d" },
  Possessed: { core: "#a78bfa", shell: "#7fe0b2" },
};

export default function SpectralCore({
  band,
  className = "",
  label,
}: {
  band: RiskBand;
  className?: string;
  label?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef(band);
  const [ready, setReady] = useState(false);
  // Keep the band in a ref, not in render: the animation loop reads
  // it every frame, and writing a ref during render breaks React.
  useEffect(() => {
    bandRef.current = band;
  }, [band]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let cancelled = false;
    let dispose: (() => void) | null = null;

    // Idle first: the hero text paints before Three.js is even fetched.
    // The timeout option is essential: the page runs continuous rAF
    // animation (mist canvas, core loop), so without it the idle
    // callback can starve forever and the core never appears. With
    // timeout 1500 the callback fires within 1.5s even on a busy page.
    // Read requestIdleCallback off a cast, not an `in` check: the
    // `in` narrowing collapses window to never in the else branch.
    const ric = (
      window as unknown as {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;
    const idle = ric
      ? ric(start, { timeout: 1500 })
      : window.setTimeout(start, 300);

    async function start() {
      if (cancelled) return;
      // Re-narrow here: TypeScript resets the outer narrowing across
      // the await below, so the guard must live inside start().
      if (!wrap) return;
      const THREE = await import("three");
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "low-power",
      });
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 1.75),
      );
      renderer.setClearColor(0x000000, 0);
      wrap.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 0, 7.2);

      const group = new THREE.Group();
      scene.add(group);

      const colors = BAND_COLORS[bandRef.current];
      const coreColor = new THREE.Color(colors.core);
      const shellColor = new THREE.Color(colors.shell);
      const ecto = new THREE.Color("#7fe0b2");
      const amber = new THREE.Color("#e8c85a");

      const disposables: Array<{ dispose(): void }> = [];
      const track = <T extends { dispose(): void }>(v: T): T => {
        disposables.push(v);
        return v;
      };

      // Layer 1: outer shell, violet, barely there.
      const shell1 = new THREE.Mesh(
        track(new THREE.SphereGeometry(1.5, 32, 32)),
        track(
          new THREE.MeshBasicMaterial({
            color: shellColor,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
      group.add(shell1);

      // Layer 2: second shell, wider, green, fainter still.
      const shell2 = new THREE.Mesh(
        track(new THREE.SphereGeometry(1.9, 32, 32)),
        track(
          new THREE.MeshBasicMaterial({
            color: ecto,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
      group.add(shell2);

      // Layer 3: the glowing inner core.
      const core = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.5, 24, 24)),
        track(
          new THREE.MeshBasicMaterial({
            color: coreColor,
            transparent: true,
            opacity: 0.95,
          }),
        ),
      );
      group.add(core);

      // Layer 4: core glow, a larger additive halo around the core.
      const glow = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.74, 24, 24)),
        track(
          new THREE.MeshBasicMaterial({
            color: coreColor,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
      group.add(glow);

      // Layer 5: particle field inside the core.
      const COUNT = 380;
      const positions = new Float32Array(COUNT * 3);
      const pcolors = new Float32Array(COUNT * 3);
      const palette = [coreColor, ecto, amber];
      for (let i = 0; i < COUNT; i++) {
        // Random point in a sphere (rejection-free: cube-root radius).
        const r = 0.92 * Math.cbrt(Math.random());
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        const c = palette[i % palette.length];
        pcolors[i * 3] = c.r;
        pcolors[i * 3 + 1] = c.g;
        pcolors[i * 3 + 2] = c.b;
      }
      const pgeo = track(new THREE.BufferGeometry());
      pgeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      pgeo.setAttribute("color", new THREE.BufferAttribute(pcolors, 3));
      const points = new THREE.Points(
        pgeo,
        track(
          new THREE.PointsMaterial({
            size: 0.045,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
      group.add(points);

      // Layer 6: wireframe inner cage.
      const cage = new THREE.Mesh(
        track(new THREE.IcosahedronGeometry(1.05, 1)),
        track(
          new THREE.MeshBasicMaterial({
            color: ecto,
            wireframe: true,
            transparent: true,
            opacity: 0.32,
          }),
        ),
      );
      group.add(cage);

      // Layer 7: three thin orbiting rings, each tilted differently.
      const rings: Mesh[] = [];
      const ringSpecs: Array<{
        radius: number;
        color: Color;
        tilt: [number, number, number];
        speed: number;
      }> = [
        { radius: 2.05, color: shellColor, tilt: [1.15, 0.2, 0], speed: 0.25 },
        { radius: 2.4, color: ecto, tilt: [0.4, 0.9, 0.5], speed: -0.18 },
        { radius: 2.75, color: amber, tilt: [1.9, 0, 0.7], speed: 0.12 },
      ];
      for (const spec of ringSpecs) {
        const ring = new THREE.Mesh(
          track(new THREE.TorusGeometry(spec.radius, 0.012, 8, 72)),
          track(
            new THREE.MeshBasicMaterial({
              color: spec.color,
              transparent: true,
              opacity: 0.55,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          ),
        );
        ring.rotation.set(...spec.tilt);
        ring.userData.speed = spec.speed;
        ring.userData.baseTilt = spec.tilt;
        group.add(ring);
        rings.push(ring);
      }

      // Sizing.
      const resize = () => {
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      // Interaction: drag to rotate, mouse parallax.
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let targetRotY = 0;
      let targetRotX = 0;
      const mouse = { x: 0, y: 0 };
      const onDown = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        wrap.style.cursor = "grabbing";
      };
      const onMove = (e: PointerEvent) => {
        const rect = wrap.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
        mouse.y = ((e.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
        if (!dragging) return;
        targetRotY += (e.clientX - lastX) * 0.006;
        targetRotX = Math.max(
          -0.7,
          Math.min(0.7, targetRotX + (e.clientY - lastY) * 0.006),
        );
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const onUp = () => {
        dragging = false;
        wrap.style.cursor = "grab";
      };
      wrap.style.cursor = "grab";
      wrap.style.touchAction = "pan-y";
      wrap.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);

      // Pause when offscreen.
      let visible = true;
      const io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
        },
        { threshold: 0.02 },
      );
      io.observe(wrap);

      const targetCore = new THREE.Color(colors.core);
      const targetShell = new THREE.Color(colors.shell);
      let raf = 0;
      // THREE.Timer replaces the deprecated THREE.Clock in r187.
      const timer = new THREE.Timer();
      let autoRot = 0;

      const render = () => {
        timer.update();
        const dt = Math.min(timer.getDelta(), 0.05);
        const t = timer.getElapsed();
        autoRot += dt * 0.12;
        // Ease the group toward drag + parallax + auto rotation.
        group.rotation.y +=
          (targetRotY + autoRot + mouse.x * 0.12 - group.rotation.y) * 0.07;
        group.rotation.x +=
          (targetRotX + mouse.y * 0.08 - group.rotation.x) * 0.07;
        // Breathe: core pulses, shells counter-rotate slowly.
        const pulse = 1 + Math.sin(t * 1.6) * 0.05;
        core.scale.setScalar(pulse);
        glow.scale.setScalar(pulse * 1.06);
        shell1.rotation.y = t * 0.05;
        shell2.rotation.y = -t * 0.03;
        cage.rotation.y = t * 0.1;
        cage.rotation.x = t * 0.04;
        points.rotation.y = -t * 0.15;
        for (const ring of rings) {
          ring.rotation.z += ring.userData.speed * dt;
        }
        // Band colour shift: ease materials toward the target.
        const want = BAND_COLORS[bandRef.current];
        targetCore.set(want.core);
        targetShell.set(want.shell);
        (core.material as MeshBasicMaterial).color.lerp(targetCore, 0.06);
        (glow.material as MeshBasicMaterial).color.lerp(targetCore, 0.06);
        (shell1.material as MeshBasicMaterial).color.lerp(targetShell, 0.06);
        (rings[0].material as MeshBasicMaterial).color.lerp(targetShell, 0.06);
        renderer.render(scene, camera);
      };

      if (reduced) {
        render();
        setReady(true);
      } else {
        const loop = () => {
          raf = requestAnimationFrame(loop);
          if (visible) render();
        };
        raf = requestAnimationFrame(loop);
        setReady(true);
      }

      dispose = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("resize", resize);
        wrap.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        for (const d of disposables) d.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    }

    return () => {
      cancelled = true;
      if (typeof idle === "number") {
        if ("cancelIdleCallback" in window) {
          (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idle);
        } else {
          clearTimeout(idle);
        }
      }
      if (dispose) dispose();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={label ?? "Spectral core: layered shells around a glowing centre"}
      className={`relative ${className}`}
    >
      {!ready && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(167,139,250,0.28) 0%, rgba(167,139,250,0.10) 38%, transparent 68%)",
          }}
        />
      )}
    </div>
  );
}
