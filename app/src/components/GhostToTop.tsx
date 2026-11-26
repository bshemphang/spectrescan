// SpectreScan — the ghost back-to-top button. A small friendly
// ghost, fixed bottom-right, that appears only after the reader has
// scrolled 480 pixels down. Clicking it floats the page back to the
// top; the ghost does one quick spin on arrival. It never annoys:
// it hides while the footer is in view (so it never covers footer
// text on mobile) and while the bubble-map detail panel is open
// (the map sets body[data-panel-open] for that). It is a real
// button: keyboard focusable, aria-labelled, Enter and Space work
// natively. Under prefers-reduced-motion it jumps straight to the
// top with no spin and no bobbing.

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GhostShape from "./GhostShape";

export default function GhostToTop() {
  const [scrolled, setScrolled] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [textBlocked, setTextBlocked] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [reduced, setReduced] = useState(false);
  // The layout persists across client-side navigation, so the
  // effect re-runs on every route change: otherwise the
  // data-ghost-hide elements on a freshly opened scan page would
  // never be observed.
  const pathname = usePathname();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onScroll = () => setScrolled(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Hide while the footer is on screen, so the button never
    // covers footer text on a narrow phone.
    const footer = document.querySelector("footer");
    let footerObserver: IntersectionObserver | null = null;
    if (footer) {
      footerObserver = new IntersectionObserver(
        ([entry]) => setFooterVisible(entry.isIntersecting),
        { threshold: 0 },
      );
      footerObserver.observe(footer);
    }

    // The bubble map sets body[data-panel-open] when its detail
    // panel opens; hide the button while it is open.
    const bodyObserver = new MutationObserver(() => {
      setPanelOpen(document.body.dataset.panelOpen === "true");
    });
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-panel-open"],
    });
    setPanelOpen(document.body.dataset.panelOpen === "true");

    // Hide while any element marked data-ghost-hide is on screen:
    // the bubble-map footer paragraph carries it, so the button
    // never covers map footer text on a narrow phone while scrolling
    // (measured at 390px). The footer observer above only covers
    // the page footer.
    let hideObserver: IntersectionObserver | null = null;
    const hideTargets = document.querySelectorAll("[data-ghost-hide]");
    if (hideTargets.length > 0) {
      hideObserver = new IntersectionObserver(
        (entries) => {
          setTextBlocked(entries.some((e) => e.isIntersecting));
        },
        { threshold: 0 },
      );
      hideTargets.forEach((el) => hideObserver?.observe(el));
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      footerObserver?.disconnect();
      bodyObserver.disconnect();
      hideObserver?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const visible = scrolled && !footerVisible && !panelOpen && !textBlocked;

  const goTop = () => {
    if (reduced) {
      window.scrollTo(0, 0);
      return;
    }
    setSpinning(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setSpinning(false), 900);
  };

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`ghost-to-top group ${visible ? "ghost-to-top-visible" : ""}`}
    >
      <span
        className={`ghost-to-top-ghost ${spinning ? "ghost-to-top-spin" : ""}`}
        aria-hidden="true"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          className="text-[var(--color-bone)]"
        >
          <GhostShape />
        </svg>
      </span>
      <span className="ghost-to-top-tip">Boo! Back to the top</span>
    </button>
  );
}
