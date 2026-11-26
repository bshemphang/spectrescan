// SpectreScan — the explorer data: curated filed cases shipped in
// the repo plus this browser's own scans. Nothing here is a live
// ranking of the whole chain: the explorer only ever shows tokens
// the site has actually scanned and filed. Every entry says where it
// came from, so a filed case never passes as a live scan and a
// browser scan never passes as a filed case.

import { CASE_FILES, type CaseFileData } from "@/lib/cases";
import type { RecentScan } from "@/lib/recent";

export interface ExplorerEntry {
  address: string;
  label: string; // token label or name
  score: number;
  band: string;
  source: "case" | "scan";
  scannedAt: string; // ISO timestamp; cases use their filed time
  caseNo?: string;
}

// Filed cases carry no filed time in the repo, so they sort by score
// and read with the label "Filed case". The date shown for a case is
// the day the case file was verified, not a scan time.
const CASE_FILED_AT = "2026-11-26T00:00:00.000Z";

export function caseToEntry(file: CaseFileData): ExplorerEntry {
  return {
    address: file.address,
    label: file.label,
    score: file.score,
    band: file.band,
    source: "case",
    scannedAt: CASE_FILED_AT,
    caseNo: file.caseNo,
  };
}

export function scanToEntry(scan: RecentScan): ExplorerEntry {
  return {
    address: scan.address,
    label: scan.name ?? scan.symbol ?? "Unknown token",
    score: scan.score,
    band: scan.band,
    source: "scan",
    scannedAt: scan.scannedAt,
  };
}

// Merge cases and browser scans, de-duplicated by address: a filed
// case wins over a browser scan of the same token, because the case
// carries the filed findings. Pure, so it is unit-testable.
export function mergeExplorerEntries(
  cases: CaseFileData[],
  scans: RecentScan[],
): ExplorerEntry[] {
  const entries = cases.map(caseToEntry);
  const caseAddresses = new Set(
    entries.map((e) => e.address.toLowerCase()),
  );
  for (const scan of scans) {
    if (caseAddresses.has(scan.address.toLowerCase())) continue;
    entries.push(scanToEntry(scan));
  }
  return entries;
}

export type ExplorerSort =
  | "haunted" // highest score first
  | "calm" // lowest score first
  | "newest"
  | "oldest";

export function sortExplorerEntries(
  entries: ExplorerEntry[],
  sort: ExplorerSort,
): ExplorerEntry[] {
  const sorted = [...entries];
  switch (sort) {
    case "haunted":
      return sorted.sort((a, b) => b.score - a.score);
    case "calm":
      return sorted.sort((a, b) => a.score - b.score);
    case "newest":
      return sorted.sort(
        (a, b) =>
          new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime(),
      );
    case "oldest":
      return sorted.sort(
        (a, b) =>
          new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime(),
      );
  }
}

// Filter by band and by free text over label and address. Pure, so
// it is unit-testable.
export function filterExplorerEntries(
  entries: ExplorerEntry[],
  query: string,
  band: string | "all",
): ExplorerEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (band !== "all" && e.band !== band) return false;
    if (!q) return true;
    return (
      e.label.toLowerCase().includes(q) ||
      e.address.toLowerCase().includes(q)
    );
  });
}

export const EXPLORER_BANDS = [
  "Resting in peace",
  "Mildly haunted",
  "Haunted",
  "Possessed",
] as const;
