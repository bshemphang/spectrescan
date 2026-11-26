// SpectreScan — recent scans kept in this browser only (localStorage).
// Real scans only: nothing is ever invented or seeded here. If the list
// is empty, the UI says so instead of showing fake activity.

export interface RecentScan {
  address: string;
  name: string | null;
  symbol: string | null;
  score: number;
  band: string;
  scannedAt: string; // ISO timestamp
}

const KEY = "spectrescan:recent";
const MAX = 10;

export function loadRecent(): RecentScan[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecentScan =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as RecentScan).address === "string" &&
          /^0x[0-9a-fA-F]{40}$/.test((e as RecentScan).address) &&
          typeof (e as RecentScan).score === "number" &&
          Number.isFinite((e as RecentScan).score) &&
          typeof (e as RecentScan).band === "string",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveRecent(scan: RecentScan): void {
  try {
    const rest = loadRecent().filter(
      (e) => e.address.toLowerCase() !== scan.address.toLowerCase(),
    );
    window.localStorage.setItem(
      KEY,
      JSON.stringify([scan, ...rest].slice(0, MAX)),
    );
  } catch {
    // Storage full or unavailable: recent scans are a nicety, never fatal.
  }
}
