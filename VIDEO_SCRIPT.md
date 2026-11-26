# SpectreScan — demo video script v2 (< 3 minutes)

Target length: ~2 minutes 30 seconds. Screencast + AI voiceover, no music,
no third-party trademarks. Record the app running live — no slides.
This is the Seance redesign: four-act scroll journey, Three.js spectral
core, looping mist video, address dossier, EOA wallet panel, /registry and
/how-it-works. SELO then CAKE, same as v1.

Honest-capture note: local Chromium cannot decode H.264, so the looping
hero mist video shows as its poster frame in the capture. The file itself
is verified (H.264 High profile level 3.1, faststart) and plays in a real
browser. Nothing in the video is faked.

## 0:00–0:18 — The problem (home hero)

[Show the home hero: scan form beside the spectral core. Voiceover:]

"Every day, people lose money to scam contracts. The screeners that exist
are either written for auditors — walls of code — or they hide how they
score things. If you're about to mint or buy a token, you just want one
answer in plain English: is this contract haunted?"

## 0:18–0:38 — The idea: the séance (acts two, three, four)

[Scroll through Act two, known hauntings; Act three, the autopsy with the
live scoring workbench; Act four, the lab.]

"SpectreScan is a ghost-hunter for smart contracts, rebuilt as a séance.
Act one: paste any BNB Chain address. Act two: known hauntings, real case
files. Act three: the autopsy, nine checks and the real scorer, running
live. Act four: the lab, how it was built with Kiro."

## 0:38–0:54 — Live demo: the haunted one (SELO result)

[Paste SELO: 0x903449fdca80acec639941dc3c84f439cbad5df7. Click Scan. Meter
lands on 100, Possessed.]

"Here's SELO — a real token. One hundred out of a hundred: Possessed, do
not touch. The entire supply was minted to the deployer's wallet at
launch, and there is no trading pair, so there is nowhere to sell."

## 0:54–1:09 — The address dossier (SELO dossier + findings)

[Scroll the SELO result: identity card, bubble map, transfer flow, then
the findings cards with evidence lines.]

"And this is new: the address dossier. An identity card from verifiable
chain data only, a bubble map built from real transfer logs, and the
transfer flow, so you can see where the money actually moved."

## 1:09–1:26 — Live demo: the clean one (CAKE result + bubble map)

[Click "Scan another", paste CAKE: 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82.
Meter lands on 46, Mildly haunted. Show the bubble map.]

"And here's CAKE, PancakeSwap's token. Forty-six: Mildly haunted. It has
a mint function, but minting is governed by a verified contract whose rules
are public code, so it scores lower. The ghost explains it all in plain
English, with the evidence cited."

## 1:26–1:43 — A wallet is not a contract (EOA panel, registry, how-it-works)

[Scan the wallet 0x4f0682d407ffb296068941480c09490c8e9720a2: wallet panel,
no score. Then /registry, then /how-it-works.]

"A wallet is not a contract, and SpectreScan knows it: scan a wallet and
you get a wallet panel, no haunted score, no fake findings. The registry
keeps every scan you ran, and the how-it-works page shows every rule and
every limit, honestly."

## 1:43–2:00 — Close (home hero)

[Back on the home page.]

"SpectreScan is not an audit — it says so on every page. But it turns a
question nobody can answer into one anyone can read. Built with Kiro for
Kiroween 2026, Frankenstein category. Links in the description."

[END]

## Capture list (1280x720 frames, video/frames-v2/)

- home-hero.png — hero, scan form + spectral core
- home-cases.png — Act two, known hauntings
- home-autopsy.png — Act three, autopsy + scoring workbench
- home-lab.png — Act four, the lab
- selo-top.png — SELO meter 100 Possessed + verdict
- selo-dossier.png — SELO identity card + bubble map + transfer flow
- selo-findings.png — SELO findings cards
- cake-top.png — CAKE meter 46 Mildly haunted + verdict
- cake-bubbles.png — CAKE bubble map
- eoa.png — EOA wallet panel, no score
- registry.png — /registry with the scans from this session
- how.png — /how-it-works

## Narration segments (video/audio-v2/, one mp3 per segment)

- seg01.mp3 — problem (hero)
- seg02.mp3 — the séance tour (cases, autopsy, lab)
- seg03.mp3 — SELO result
- seg04.mp3 — dossier
- seg05.mp3 — CAKE result + bubble map
- seg06.mp3 — EOA, registry, how-it-works
- seg07.mp3 — close (hero again)

Assembly: ffmpeg concat of the frames timed to the narration segments,
1280x720, libx264 + AAC, faststart. Output:
video/spectrescan-demo-v2.mp4. Old video spectrescan-demo.mp4 untouched.
