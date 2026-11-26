// SpectreScan — display formatting for dossier numbers. Amounts are
// raw uint256 strings plus the token decimals; nothing here rounds
// away the truth, it only shortens it for reading.

export function formatAmount(
  raw: string | bigint,
  decimals: number | null,
  symbol?: string | null,
): string {
  let value: bigint;
  try {
    value = typeof raw === "bigint" ? raw : BigInt(raw);
  } catch {
    return "unknown";
  }
  if (value === 0n) return symbol ? `0 ${symbol}` : "0";
  const negative = value < 0n;
  const abs = negative ? -value : value;
  let whole: string;
  let frac = "";
  if (decimals === null || decimals === 0) {
    whole = abs.toString();
  } else {
    const s = abs.toString().padStart(decimals + 1, "0");
    whole = s.slice(0, -decimals);
    frac = s.slice(-decimals).replace(/0+$/, "");
  }
  const compact = compactNumber(whole, frac);
  const out = `${negative ? "-" : ""}${compact}${symbol ? ` ${symbol}` : ""}`;
  return out;
}

// Shorten a big whole number: 1,240,000 -> 1.24M. The fraction digits
// are kept only when the whole part is small.
function compactNumber(whole: string, frac: string): string {
  const digits = whole.length;
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (digits <= 6) {
    return frac ? `${withCommas}.${frac.slice(0, 2)}` : withCommas;
  }
  const units: Array<[number, string]> = [
    [13, "T"],
    [10, "B"],
    [7, "M"],
    [4, "K"],
  ];
  for (const [len, suffix] of units) {
    if (digits >= len) {
      const int = whole.slice(0, digits - (len - 1));
      const rest = whole.slice(digits - (len - 1), digits - (len - 1) + 2);
      const dec = rest.replace(/0+$/, "");
      return `${int}${dec ? `.${dec}` : ""}${suffix}`;
    }
  }
  return withCommas;
}

// Human age from a Unix timestamp in seconds: "3h", "2d 4h", "5mo".
// Used for the "at least this old" lower bound from the first seen
// transfer, so the wording is always "at least", never exact.
export function formatAgeAtLeast(unixSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  const mins = Math.floor(seconds / 60);
  if (mins < 1) return "at least a minute";
  if (mins < 60) return `at least ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `at least ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) {
    const h = hours % 24;
    return h > 0 ? `at least ${days}d ${h}h` : `at least ${days}d`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) return `at least ${months}mo`;
  const years = Math.floor(months / 12);
  return `at least ${years}y`;
}

export function formatDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(unixSeconds * 1000));
}

// Short form for display: 0x1234…5678. The full address stays in a
// title attribute or a copyable element, never hidden entirely.
export function shortAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

// Share of total supply as a percentage, with enough decimals to
// mean something when the share is tiny: a big-supply token's top
// window mover can hold 0.0001% and still be the biggest bubble.
// Never rounds a real share to "0.0%".
export function formatShare(share: number | null): string {
  if (share === null) return "?";
  if (share >= 10) return `${share.toFixed(1)}%`;
  if (share >= 0.1) return `${share.toFixed(2)}%`;
  if (share >= 0.0001) return `${share.toFixed(4)}%`;
  return "<0.0001%";
}
