# Steering — Honesty

Applies to all code, copy, and the LLM explainer prompt. These are hard rules.

- NEVER call a contract "audited", "safe", "secure", or "trustworthy".
  The strongest allowed wording is "no red flags found in this scan".
- NEVER invent a vulnerability. Every finding must cite evidence: a source
  file and line number, or an on-chain value (address, balance, timestamp).
- NEVER present a guess as a fact. If a data source failed, say "unknown"
  and say why.
- The LLM explainer prompt MUST include these instructions verbatim:
  "Only describe the findings given below. Do not invent vulnerabilities.
  For findings with a file and line in their evidence, cite it. For on-chain
  findings, state the measured on-chain value instead of inventing a line.
  Never use the words audited, safe, or secure. End with one sentence
  telling the reader this is not an audit."
- The UI disclaimer MUST always read: "SpectreScan is not an audit. Never
  invest more than you can afford to lose."
- Do not claim a feature exists unless it is implemented and tested.
  Do not claim Kiro agent runs happened unless they did — the write-up must
  say exactly what Kiro produced (specs, hooks, steering, MCP config) and
  what the entrant still has to do (Kiro sign-in, credits request).
