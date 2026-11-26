// SpectreScan — the friendly ghost shape. An original design: a
// dome head, a wavy sheet hem, two dot eyes. It is not copied from
// any existing mascot or trademarked character. Drawn as bare SVG
// shapes (no wrapping <svg>) so it can sit inside a transformed
// <g> on the bubble map, or inside an <svg> in HTML. The body
// takes currentColor; the eyes stay dark so they read on any
// light ghost.

export default function GhostShape() {
  return (
    <>
      <path
        d="M12 2C7.03 2 3 6.03 3 11v9.5l3-2.25 3 2.25 3-2.25 3 2.25 3-2.25 3 2.25V11c0-4.97-4.03-9-9-9z"
        fill="currentColor"
      />
      <circle cx="9" cy="10" r="1.7" fill="#0c0a12" />
      <circle cx="15" cy="10" r="1.7" fill="#0c0a12" />
    </>
  );
}
