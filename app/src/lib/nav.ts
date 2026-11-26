// SpectreScan — shared navigation model. One source of truth for which
// section a pathname belongs to, so the desktop nav, the mobile tab bar,
// and the tests all agree on what is active. The dossier (/scan/[address])
// is the Explorer's detail view, so it marks Explorer active: the reader
// is looking at one explored token, not a separate section.

export type NavKey =
  | "home"
  | "explorer"
  | "watchlist"
  | "wallet"
  | "learn"
  | "api"
  | "registry"
  | "bulk"
  | "how";

export interface NavItem {
  key: NavKey;
  href: string;
  label: string;
}

// Desktop header nav, left to right. Every page is linked from the
// header, so no page is more than one click away on a wide screen.
export const DESKTOP_NAV: NavItem[] = [
  { key: "explorer", href: "/explorer", label: "Explorer" },
  { key: "watchlist", href: "/watchlist", label: "Watchlist" },
  { key: "wallet", href: "/wallet", label: "Wallet" },
  { key: "learn", href: "/learn", label: "Learn" },
  { key: "api", href: "/api-docs", label: "API" },
  { key: "registry", href: "/registry", label: "Registry" },
  { key: "bulk", href: "/bulk", label: "Bulk" },
  { key: "how", href: "/how-it-works", label: "How it works" },
];

// Mobile bottom tab bar: the four sections people use most, thumb-reachable.
// Everything else lives behind More.
export const TAB_NAV: NavItem[] = [
  { key: "home", href: "/", label: "Home" },
  { key: "explorer", href: "/explorer", label: "Explorer" },
  { key: "watchlist", href: "/watchlist", label: "Watchlist" },
  { key: "wallet", href: "/wallet", label: "Wallet" },
];

// The More sheet: the rest of the site, in full, never truncated.
export const MORE_NAV: NavItem[] = [
  { key: "learn", href: "/learn", label: "Learn" },
  { key: "api", href: "/api-docs", label: "API" },
  { key: "registry", href: "/registry", label: "Registry" },
  { key: "bulk", href: "/bulk", label: "Bulk scan" },
  { key: "how", href: "/how-it-works", label: "How it works" },
];

export function getActiveNav(pathname: string | null | undefined): NavKey | null {
  if (!pathname) return null;
  if (pathname === "/") return "home";
  if (pathname === "/explorer" || pathname.startsWith("/scan/")) return "explorer";
  if (pathname.startsWith("/watchlist")) return "watchlist";
  if (pathname.startsWith("/wallet")) return "wallet";
  if (pathname.startsWith("/learn")) return "learn";
  if (pathname.startsWith("/api-docs")) return "api";
  if (pathname.startsWith("/registry")) return "registry";
  if (pathname.startsWith("/bulk")) return "bulk";
  if (pathname.startsWith("/how-it-works")) return "how";
  return null;
}
