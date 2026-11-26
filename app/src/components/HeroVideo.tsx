// SpectreScan — hero background video: a real looping video, not a
// CSS effect. Generated locally with ffmpeg from code-drawn frames:
// slow drifting violet mist and ectoplasm particles over near-black,
// 12 seconds, seamless loop, 511 KiB at 720p. Muted, looped,
// playsinline, with a poster still as fallback. The video never
// renders under prefers-reduced-motion (the poster shows instead),
// and it pauses whenever the hero scrolls offscreen, so it costs
// nothing on a phone past the first screen.

"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Image from "next/image";

function subscribeMotion(onChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function motionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // The motion preference is external state, so it is read with
  // useSyncExternalStore: the server snapshot assumes motion is fine,
  // and the client re-renders to the poster when reduced motion is
  // preferred, with no hydration mismatch and no effect setState.
  const reduced = useSyncExternalStore(
    subscribeMotion,
    motionSnapshot,
    () => false,
  );
  const motionOK = !reduced;

  useEffect(() => {
    if (!motionOK) return;
    const video = videoRef.current;
    const box = boxRef.current;
    if (!video || !box) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.05 },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [motionOK]);

  return (
    <div
      ref={boxRef}
      aria-hidden
      className="absolute inset-0 overflow-hidden"
    >
      {motionOK ? (
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/hero-mist-poster.jpg"
        >
          <source src="/hero-mist.mp4" type="video/mp4" />
        </video>
      ) : (
        <Image
          src="/hero-mist-poster.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
      )}
      {/* Scrim: the video is a backdrop, the headline must win. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0c0a12]/75 via-[#0c0a12]/60 to-[#0c0a12]" />
    </div>
  );
}
