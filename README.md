# THE GILDED VAULT — a heist game

[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun)
[![competition](https://img.shields.io/badge/competition-best--heist--game--20261122--0559-gold)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![referral](https://img.shields.io/badge/referral-gwb6amaf-green)](https://make.fun/r/gwb6amaf)

Entry for the [make.fun best heist game bounty](https://make.fun/bounty/best-heist-game-20261122-0559).

**Marlow Quinn** slips into the vault house of collector Aldous Vane to steal
the **Sunstar Diamond** — then has to get back out through the vault door.
One room, three guards with sweeping vision cones, two CCTV cameras, an alarm
meter that fills when you are seen, and tools that cost alarm: an EMP that
kills the cameras and a noisemaker that lures guards away. Get caught during
lockdown and you lose a nerve and wake up back at the entrance — three nerves,
then it's over.

## Play

Open `game/index.html` in desktop Chrome (no network, no build step) or serve
`game/` with any static server:

```
python3 -m http.server --directory game 8080
```

- **WASD / arrows / click** — move (click-to-move included)
- **Shift** — sneak (slower, harder to spot, quieter)
- **E** — grab loot near a pedestal
- **1** — EMP: CCTV offline 10s, but the alarm jumps +12
- **2 then click** — throw a noisemaker: nearby guards investigate, alarm +6
- **P** — pause, **R** — restart after win / game over

Win by grabbing the Sunstar Diamond and reaching the EXIT vault door.
Ratings: **GHOST** (never spotted), **CLEAN GETAWAY**, or **LOUD GETAWAY**.

## Structure

`game/src/` — one clear job per file:

| file | job |
|---|---|
| `config.js` | tuning constants + art-deco palette |
| `level.js` | the vault-house map, patrols, cameras, BFS, line of sight |
| `player.js` | movement (penetration-resolving collision), loot, tools |
| `guards.js` | patrol / suspicious / alert / search, raycast vision cones |
| `cameras.js` | sweeping CCTV cones, EMP offline timer |
| `audio.js` | pure WebAudio sounds, no audio files |
| `render.js` | canvas drawing, darkness + light holes, HUD, panels |
| `world.js` | game state machine, alarm, lockdown, caught, win |
| `shots.js` | deterministic screenshot states + in-sim pilot |
| `input.js` | keyboard + mouse |
| `main.js` | bootstrap + `window.__gameState()` / `__pilot()` hooks |

`main.ts` at the repo root hands the entry in: it copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with
`buildDossier` from `vendor/makefun-game.ts` (kit copy, unchanged).

All art is drawn in code and all sound is synthesized with WebAudio — an
original game, no copied assets, characters, or levels.
