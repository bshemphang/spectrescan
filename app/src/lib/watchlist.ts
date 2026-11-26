// SpectreScan — watchlist kept in this browser only (localStorage).
// Starring a token is the reason to come back: the watchlist page
// re-scans on open and shows what moved. Real scans only: an entry
// is created from a real scan result, never seeded or invented.

export interface WatchEntry {
  address: string;
  name: string | null;
  symbol: string | null;
  score: number;
  band: string;
  addedAt: string; // ISO timestamp
  lastScannedAt: string; // ISO timestamp of the last scan that set score/band
}

const KEY = "spectrescan:watchlist";
const MAX = 50;

export function loadWatchlist(): WatchEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is WatchEntry =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as WatchEntry).address === "string" &&
          /^0x[0-9a-fA-F]{40}$/.test((e as WatchEntry).address) &&
          typeof (e as WatchEntry).score === "number" &&
          Number.isFinite((e as WatchEntry).score) &&
          typeof (e as WatchEntry).band === "string",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function isWatched(address: string): boolean {
  return loadWatchlist().some(
    (e) => e.address.toLowerCase() === address.toLowerCase(),
  );
}

export function watchToken(entry: WatchEntry): void {
  try {
    const rest = loadWatchlist().filter(
      (e) => e.address.toLowerCase() !== entry.address.toLowerCase(),
    );
    window.localStorage.setItem(
      KEY,
      JSON.stringify([entry, ...rest].slice(0, MAX)),
    );
  } catch {
    // Storage full or unavailable: starring is a nicety, never fatal.
  }
}

export function unwatchToken(address: string): void {
  try {
    const rest = loadWatchlist().filter(
      (e) => e.address.toLowerCase() !== address.toLowerCase(),
    );
    window.localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // Ignore storage failures here too.
  }
}

export function updateWatched(entry: WatchEntry): void {
  // Same as watchToken: upsert by address, newest first.
  watchToken(entry);
}
