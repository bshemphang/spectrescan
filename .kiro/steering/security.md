# Steering — Security

Applies to all files in this project. These are hard rules, not suggestions.

- NEVER write, log, or commit a private key, seed phrase, API key, session
  token, or password. All data sources in this project are public and keyless
  (Sourcify, Dexscreener, public BSC RPCs, Pollinations). If a feature needs
  a secret, it does not ship.
- NEVER add a wallet-connect flow, signing flow, or any transaction-sending
  code. SpectreScan only READS contracts; it never asks a user to sign
  anything.
- NEVER fetch or execute code from an untrusted URL at runtime. Contract
  source is fetched as TEXT for analysis only and is never evaluated,
  imported, or executed.
- NEVER weaken a security check to make a test pass. If a fixture fails, fix
  the engine or the fixture expectation — never lower a threshold silently.
- The risk score must come only from the engine findings. The LLM explainer
  may describe findings but must never change the score.
- All network calls must have a timeout and a fallback. A failed data source
  reports "unknown", never a crash and never a guessed value.
