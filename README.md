# The Stolen Fire

A 2D action roguelite inspired by Greek myth, in the spirit of Dead Cells and Hades.

Prometheus stole fire from the gods and gave it to humanity. Zeus chained him to a rock in the deepest pit of Tartarus, and every day an eagle tore out his heart while it grew back. After centuries of this, Prometheus breaks free, steals the fire a second time, and fights his way up: out of Tartarus, through the gods, to Zeus in the heavens.

**Play:** https://lucid4an.github.io/the-stolen-fire/

## Chapter I: Tartarus

- **The Rock (hub):** talk to Epimetheus, pick a fire form at the weapon rack, and spend ichor at the Altar of the Titans on permanent upgrades.
- **Chambers:** each one holds two waves of foes. The exits show what they lead to: a boon, ichor, ambrosia, a Titan's ember or Hephaestus' anvil.
- **Boons of the Titans:** Kronos, Atlas, Hecate and Themis still hate Zeus. Each offers four boons that change your dash, attacks and fire.
- **Foes:** Chained Shades, Eaglets, Hundred-Handed Fists, Bronze Wardens and Lampads.
- **Boss:** Aethon, the Eagle of Zeus, the bird that ate your heart for five hundred years.

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | A / D or arrows | Left stick / D-pad |
| Jump | Space or Z | A |
| Attack | J or X | X |
| Special | K or C | Y |
| Dash | Shift or L | B, LT, RT |
| Cast fire | I or V | RB |
| Use / talk | E or F | LB |
| Pause | Esc or P | Start |

Touch controls appear on phones and tablets.

## Tech

Plain HTML5 canvas and JavaScript. There is no build step and there are no dependencies. All art is pixel art drawn procedurally at runtime at 480×270, with a darkness-and-fire lighting pass. Progress is saved in `localStorage`.

To run it locally, serve the folder with any static server:

```bash
python -m http.server 8788
```

| File | What it holds |
| --- | --- |
| `js/core.js` | Math helpers, input (keyboard, gamepad, touch), synthesized sound, save data |
| `js/gfx.js` | Canvas scaling, camera, particles, damage numbers, lighting |
| `js/rooms.js`, `js/room.js` | Chamber layouts, tile collision and cached tile art |
| `js/sprites.js` | Prometheus, the mobs and the Eagle |
| `js/data.js` | Weapons, Titans, boons, rewards, upgrades, dialogue |
| `js/player.js` | Movement, combat, boon effects |
| `js/enemies.js` | Mob AI, projectiles, the Eagle boss |
| `js/run.js` | Run state, rewards, pickups, doors |
| `js/ui.js`, `js/main.js` | Screens, HUD, game flow and the frame loop |

The design notes are in [docs/design.md](docs/design.md).
