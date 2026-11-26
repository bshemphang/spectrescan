# SpectreScan — demo video script (< 3 minutes)

Target length: ~2 minutes 30 seconds. Screencast + voiceover, no music,
no third-party trademarks. Record the app running live — no slides.

## 0:00–0:25 — The problem

[Show a phone-style shot of a token page / a mint link. Voiceover:]

"Every day, people lose money to scam contracts. The screeners that exist
are either written for auditors — walls of code — or they hide how they
score things. If you're about to mint or buy a token, you just want one
answer in plain English: is this contract haunted?"

## 0:25–0:50 — The idea

[Show the SpectreScan home page.]

"SpectreScan is a ghost-hunter for smart contracts. Paste any BNB Chain
contract address. It reads the verified source, checks the owner, the
liquidity lock and the holders, and gives you a haunting report — with the
exact lines cited. It's built the Kiro way: specs first, a deterministic
rules engine, a custom MCP server, and property-based tests proving the
score can't lie."

## 0:50–1:40 — Live demo: the haunted one

[Paste SELO: 0x903449fdca80acec639941dc3c84f439cbad5df7. Click Scan.]

"Here's SELO — a real token. Watch the ghost meter. One hundred out of a
hundred: Possessed, do not touch. The entire supply was minted to the deployer's wallet at
launch — that's line 22 of the source — and there is no trading pair, so
there is nowhere to sell. One address holds everything."

[Scroll through the findings cards; point at the evidence lines.]

## 1:40–2:10 — Live demo: the clean one

[Click "Scan another", paste CAKE: 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82.]

"And here's CAKE, PancakeSwap's token. Forty-six: Mildly haunted. It has
a mint function, but minting is governed by a verified contract whose rules
are public code — so it scores lower. The ghost's verdict explains all of
this in plain English, with the lines cited."

## 2:10–2:30 — Close

[Back on the home page.]

"SpectreScan is not an audit — it says so on every page. But it turns a
question nobody can answer into one anyone can read. Built with Kiro for
Kiroween 2026, Frankenstein category. Links in the description."
