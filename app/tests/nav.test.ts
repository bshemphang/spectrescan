// SpectreScan — navigation model tests. The active-page marking is the
// fix for the user's complaint (he could not tell which page he was
// on), so the mapping is pinned here: every route maps to exactly one
// section, the dossier maps to Explorer, and unknown paths map to none.

import { describe, expect, it } from "vitest";
import {
  DESKTOP_NAV,
  MORE_NAV,
  TAB_NAV,
  getActiveNav,
} from "../src/lib/nav";

describe("getActiveNav", () => {
  it("marks the homepage", () => {
    expect(getActiveNav("/")).toBe("home");
  });

  it("marks each top-level page", () => {
    expect(getActiveNav("/explorer")).toBe("explorer");
    expect(getActiveNav("/watchlist")).toBe("watchlist");
    expect(getActiveNav("/wallet")).toBe("wallet");
    expect(getActiveNav("/learn")).toBe("learn");
    expect(getActiveNav("/api-docs")).toBe("api");
    expect(getActiveNav("/registry")).toBe("registry");
    expect(getActiveNav("/bulk")).toBe("bulk");
    expect(getActiveNav("/how-it-works")).toBe("how");
  });

  it("marks the dossier as Explorer, its parent section", () => {
    expect(getActiveNav("/scan/0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82")).toBe(
      "explorer",
    );
  });

  it("marks nested pages under their section", () => {
    expect(getActiveNav("/learn/rug-case-1")).toBe("learn");
    expect(getActiveNav("/registry?page=2")).toBe("registry");
  });

  it("returns null for unknown paths and for no pathname", () => {
    expect(getActiveNav("/not-a-page")).toBeNull();
    expect(getActiveNav(null)).toBeNull();
    expect(getActiveNav(undefined)).toBeNull();
  });
});

describe("nav lists", () => {
  it("desktop nav covers every page except home (the wordmark is home)", () => {
    const keys = DESKTOP_NAV.map((item) => item.key);
    for (const key of [
      "explorer",
      "watchlist",
      "wallet",
      "learn",
      "api",
      "registry",
      "bulk",
      "how",
    ] as const) {
      expect(keys).toContain(key);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("tab bar and More sheet together cover every page exactly once", () => {
    const keys = [...TAB_NAV, ...MORE_NAV].map((item) => item.key);
    for (const key of [
      "home",
      "explorer",
      "watchlist",
      "wallet",
      "learn",
      "api",
      "registry",
      "bulk",
      "how",
    ] as const) {
      expect(keys).toContain(key);
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("no label is truncated in the source: How it works reads in full", () => {
    const labels = [...DESKTOP_NAV, ...MORE_NAV].map((item) => item.label);
    expect(labels).toContain("How it works");
    expect(labels).not.toContain("How it work");
  });
});
