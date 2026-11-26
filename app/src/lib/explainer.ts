// SpectreScan — LLM explainer (spec REQ-5).
// Turns engine findings into plain English via the keyless Pollinations
// text endpoint. The explainer NEVER changes the score and NEVER invents
// findings: the prompt carries the hard instruction block from
// .kiro/steering/honesty.md verbatim. On failure it returns null and the
// UI falls back to the raw findings list.

import type { ScanResult } from "./engine/types";
import { fetchWithTimeout } from "./engine/fetchers";

const HONESTY_BLOCK = [
  "Only describe the findings given below. Do not invent vulnerabilities.",
  "Cite the file and line for every claim.",
  "Never use the words audited, safe, or secure.",
  "End with one sentence telling the reader this is not an audit.",
].join(" ");

export function buildExplainerPrompt(result: ScanResult): string {
  const lines = result.findings.map(
    (f) =>
      `- [${f.severity}] ${f.title}: ${f.detail} Evidence: ${f.evidence.join("; ") || "none"}`,
  );
  return [
    "You are the ghost of SpectreScan, a contract haunting reporter. Explain the scan below in plain English for a non-technical reader, in under 180 words.",
    HONESTY_BLOCK,
    "",
    `Contract: ${result.address} (BSC, chain 56)`,
    `Token: ${result.token.name ?? "unknown"} (${result.token.symbol ?? "?"})`,
    `Risk score: ${result.score}/100 — ${result.band}`,
    `Source verified: ${result.verified ? "yes" : "no"}`,
    "",
    "Findings:",
    ...lines,
  ].join("\n");
}

export async function explainScan(result: ScanResult): Promise<string | null> {
  const prompt = buildExplainerPrompt(result);
  // POST is used instead of the GET endpoint: the GET endpoint truncates
  // long prompts and is slow to time out; POST (OpenAI-compatible JSON,
  // model "openai") returns complete answers reliably.
  const body = JSON.stringify({
    model: "openai",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    // The "openai" model reasons before answering; without a low reasoning
    // effort and a large token budget it exhausts its output limit and
    // returns HTTP 400 (verified 2026-11-08).
    reasoning_effort: "low",
    max_tokens: 4096,
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout("https://text.pollinations.ai/", 45000, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) continue;
      const raw = (await res.text()).trim();
      if (!raw) continue;
      let text = raw;
      try {
        const json = JSON.parse(raw) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = json.choices?.[0]?.message?.content;
        if (typeof content === "string" && content.trim()) text = content.trim();
      } catch {
        // Not JSON — treat the raw body as the answer.
      }
      if (!text) continue;
      // Never let the explainer smuggle in banned reassurance.
      if (/\baudited\b|\b100% safe\b|\bguaranteed safe\b/i.test(text)) return null;
      return text;
    } catch {
      // Retry once, then give up and let the UI fall back to findings.
    }
  }
  return null;
}
