// SpectreScan — re-scan snapshots kept in this browser only
// (localStorage). Every scan saves a snapshot; the next scan of the
// same address compares against it and shows what changed. The
// snapshot stores the score, the band, the finding ids with titles,
// and the scan time. It never pretends to be continuous monitoring:
// the comparison always shows both scan times, and a finding the
// engine no longer emits shows as removed, which is honest, not
// drift.

export interface ScanSnapshot {
  address: string;
  score: number;
  band: string;
  findings: Array<{ id: string; title: string }>;
  scannedAt: string; // ISO timestamp
}

export interface ScanDiff {
  scoreDelta: number; // new minus old; negative means the score fell
  previousScore: number;
  previousBand: string;
  bandChanged: boolean;
  gained: Array<{ id: string; title: string }>; // findings present now, absent before
  lost: Array<{ id: string; title: string }>; // findings present before, absent now
  previousAt: string;
  currentAt: string;
}

const KEY = "spectrescan:snapshots";
const MAX = 50;

export function loadSnapshots(): ScanSnapshot[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is ScanSnapshot =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as ScanSnapshot).address === "string" &&
          /^0x[0-9a-fA-F]{40}$/.test((s as ScanSnapshot).address) &&
          typeof (s as ScanSnapshot).score === "number" &&
          Number.isFinite((s as ScanSnapshot).score) &&
          Array.isArray((s as ScanSnapshot).findings) &&
          (s as ScanSnapshot).findings.every(
            (f) =>
              typeof f === "object" &&
              f !== null &&
              typeof (f as { id?: unknown }).id === "string" &&
              typeof (f as { title?: unknown }).title === "string",
          ),
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function loadSnapshot(address: string): ScanSnapshot | null {
  return (
    loadSnapshots().find(
      (s) => s.address.toLowerCase() === address.toLowerCase(),
    ) ?? null
  );
}

export function saveSnapshot(snapshot: ScanSnapshot): void {
  try {
    const rest = loadSnapshots().filter(
      (s) => s.address.toLowerCase() !== snapshot.address.toLowerCase(),
    );
    window.localStorage.setItem(
      KEY,
      JSON.stringify([snapshot, ...rest].slice(0, MAX)),
    );
  } catch {
    // Storage full or unavailable: snapshots are a nicety, never fatal.
  }
}

// Pure diff between two snapshots of the same address. Testable
// without localStorage.
export function diffSnapshots(
  previous: ScanSnapshot,
  current: ScanSnapshot,
): ScanDiff {
  const prevIds = new Set(previous.findings.map((f) => f.id));
  const currIds = new Set(current.findings.map((f) => f.id));
  return {
    scoreDelta: current.score - previous.score,
    previousScore: previous.score,
    previousBand: previous.band,
    bandChanged: current.band !== previous.band,
    gained: current.findings.filter((f) => !prevIds.has(f.id)),
    lost: previous.findings.filter((f) => !currIds.has(f.id)),
    previousAt: previous.scannedAt,
    currentAt: current.scannedAt,
  };
}

// A scan result becomes the snapshot the next scan compares
// against. Only the comparison fields are kept: score, band,
// finding ids with titles, and the scan time.
export function toSnapshot(result: {
  address: string;
  score: number;
  band: string;
  findings: Array<{ id: string; title: string }>;
  scannedAt: string;
}): ScanSnapshot {
  return {
    address: result.address,
    score: result.score,
    band: result.band,
    findings: result.findings.map((f) => ({ id: f.id, title: f.title })),
    scannedAt: result.scannedAt,
  };
}
