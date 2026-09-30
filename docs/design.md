# The Stolen Fire — design

Prometheus stole fire for humanity. Zeus chained him to a rock in the deepest pit of Tartarus, where an
eagle tore out his heart every day while it grew back every night. After centuries the chains broke.
He stole the fire a second time, from the heart of Tartarus, and must climb out of hell and defeat the
gods in his way, up to Zeus in the heavens.

## Pillars
1. **Dead Cells combat**: side view, fast, weighty hits, hit-stop, dash with i-frames, wall jumps.
2. **Hades structure**: run of combat chambers; exits preview their reward; boons change your moves;
   a hub where the story advances after every death.
3. **You are the light**: Tartarus is dark. Prometheus' fire lights the world around him. Enemy eyes
   glow in the dark before you see their bodies.
4. **Mocking gods**: gods and monsters talk; dialogue reacts to deaths, kills and progress.

## Loop
Hub (the Rock) → choose a form of the fire → Tartarus chambers (combat, pick exit by reward) →
boss (the Eagle) → next region (later) … → death returns you to the Rock with your ichor.

## Player
Run, variable jump, coyote + buffer, wall slide/jump, dash (ground + air, i-frames, cooldown),
Attack (weapon combo), Special (weapon skill), Cast (fire bolt, uses Flame; Flame refills on kills).

## Fire forms (weapons)
- **Fire Blade**: 3-hit combo, last hit launches; Special: rising flame slash.
- **Ember Spear**: long thrusts; Special: thrown spear that returns.

## Boons (imprisoned Titans who hate Zeus)
Kronos (time/slow), Atlas (weight/stagger), Hecate (curse/hex), Themis (Prometheus' mother; justice,
shields). Each offers boons for Attack, Special, Dash, Cast, plus passives.

## Rewards on exits
Boon, Ichor (meta currency), Ambrosia (heal), Titan's Ember (max flame/health), Gold → shop later.

## Tartarus mobs
Chained Shade (melee, drags a chain), Eaglet (flying diver, feather darts), Hundred-Handed Fist
(bursts from walls/floor after a telegraph), Bronze Warden (armored automaton, shield, slam),
Lampad (torch nymph, steals flame, flees and throws fire).

## Bosses
Chapter I: the Eagle (Aethon). Later: Cerberus, Hades, then Olympus gods to Zeus.

## Tech
Plain HTML5 canvas + JavaScript, no build, 480×270 internal resolution scaled by integer steps.
All art procedural pixel art drawn at runtime. Hosted on GitHub Pages and as a Claude artifact.
