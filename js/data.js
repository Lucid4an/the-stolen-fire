'use strict';
// Game content: forms of the fire, Titans and their boons, rewards, upgrades and dialogue.

// Combo step: w windup, a active, r recovery (s); dmg; reach (px); arc [from, to] (radians, 0 = forward);
// kb knockback; lunge (px/s); launch = upward knock on final hits.
const WEAPONS = {
  blade: {
    name: 'Fire Blade', desc: 'The stolen fire shaped into a sword. Fast three-hit combo; the last strike launches foes.',
    special: 'Rising Flame: an upward slash that launches enemies and you with them.',
    combo: [
      { w: 0.06, a: 0.08, r: 0.14, dmg: 11, reach: 30, arc: [-1.9, 0.9], kb: 90, lunge: 90, sfx: 'swing' },
      { w: 0.06, a: 0.08, r: 0.14, dmg: 11, reach: 30, arc: [1.0, -1.6], kb: 90, lunge: 90, sfx: 'swing' },
      { w: 0.12, a: 0.10, r: 0.28, dmg: 22, reach: 36, arc: [-2.4, 1.2], kb: 220, lunge: 150, launch: 180, sfx: 'heavy', shake: 3 },
    ],
    specialStep: { w: 0.08, a: 0.14, r: 0.3, dmg: 20, reach: 34, arc: [1.4, -1.9], kb: 60, lunge: 40, launch: 330, rise: 300, sfx: 'heavy', shake: 3 },
    specialCd: 3,
  },
  spear: {
    name: 'Ember Spear', desc: 'A long spear of living flame. Reaching thrusts; the third pierces everything in line.',
    special: 'Hurl: throw the spear through enemies; it returns to your hand.',
    combo: [
      { w: 0.09, a: 0.08, r: 0.16, dmg: 13, reach: 48, arc: [0, 0], kb: 110, lunge: 60, thrust: true, sfx: 'swing' },
      { w: 0.09, a: 0.08, r: 0.16, dmg: 13, reach: 48, arc: [0, 0], kb: 110, lunge: 60, thrust: true, sfx: 'swing' },
      { w: 0.16, a: 0.12, r: 0.3, dmg: 26, reach: 60, arc: [0, 0], kb: 240, lunge: 180, thrust: true, sfx: 'heavy', shake: 3 },
    ],
    specialStep: { w: 0.14, a: 0.02, r: 0.2, throwSpear: true, dmg: 24, sfx: 'heavy' },
    specialCd: 2.5,
  },
};

const TITANS = {
  kronos: { name: 'Kronos', title: 'Titan of Time', col: '#7fd0ff', line: 'Zeus locked me in the dark too, little cousin. Take a moment. Take several.' },
  atlas: { name: 'Atlas', title: 'Titan of Endurance', col: '#e0a860', line: 'I held up the sky while you stole from it. Carry a little of its weight.' },
  hecate: { name: 'Hecate', title: 'Goddess of Crossroads', col: '#c07af0', line: 'Every road out of Tartarus crosses mine. Curse them on your way.' },
  themis: { name: 'Themis', title: 'Titan of Justice, your mother', col: '#fff0b0', line: 'My son. What they did to you was never justice. Let me set the scales right.' },
};

const BOONS = [
  { id: 'k_hours', titan: 'kronos', slot: 'Attack', name: 'Stolen Hours', desc: 'Your attacks slow foes by 40% for 2s.' },
  { id: 'k_instant', titan: 'kronos', slot: 'Dash', name: 'Eternal Instant', desc: 'Your dash leaves a rift that slows foes by 50% for 2.5s.' },
  { id: 'k_devour', titan: 'kronos', slot: 'Cast', name: 'Devouring Time', desc: 'Your fire bolt freezes its target in time for 1.5s.' },
  { id: 'k_patience', titan: 'kronos', slot: 'Passive', name: 'Patience of Ages', desc: 'Deal +30% damage to slowed or frozen foes.' },
  { id: 'a_shoulders', titan: 'atlas', slot: 'Attack', name: 'World on Your Shoulders', desc: 'Attacks knock foes back 60% harder and your finisher stuns for 0.6s.' },
  { id: 'a_sky', titan: 'atlas', slot: 'Special', name: 'Weight of the Sky', desc: 'Your special deals +60% damage.' },
  { id: 'a_earth', titan: 'atlas', slot: 'Dash', name: 'Earthbound', desc: 'Ending a dash sends out a shockwave that deals 18 damage.' },
  { id: 'a_endure', titan: 'atlas', slot: 'Passive', name: 'Titan Endurance', desc: '+30 max health.' },
  { id: 'h_curse', titan: 'hecate', slot: 'Attack', name: 'Crossroads Curse', desc: 'Your attacks hex foes for 3s. Hexed foes take +30% damage.' },
  { id: 'h_moon', titan: 'hecate', slot: 'Cast', name: 'Moon’s Mark', desc: 'Your fire bolt bursts on impact, hexing and burning everything nearby.' },
  { id: 'h_step', titan: 'hecate', slot: 'Dash', name: 'Witch’s Step', desc: 'Dashing through a foe hexes it and deals 10 damage.' },
  { id: 'h_faces', titan: 'hecate', slot: 'Passive', name: 'Three Faces', desc: '20% chance for any hit to strike twice.' },
  { id: 't_aegis', titan: 'themis', slot: 'Passive', name: 'Mother’s Aegis', desc: 'The first hit you take in each chamber is blocked.' },
  { id: 't_law', titan: 'themis', slot: 'Special', name: 'Divine Law', desc: 'Each foe your special hits heals you for 4.' },
  { id: 't_scales', titan: 'themis', slot: 'Attack', name: 'Scales of Justice', desc: '20% chance to deal a critical hit for triple damage.' },
  { id: 't_foresight', titan: 'themis', slot: 'Passive', name: 'Foresight', desc: 'Gain 25% more ichor, and heal 10 whenever you clear a chamber.' },
];

const REWARDS = {
  boon: { name: 'Boon', col: '#ffd36a' },
  ichor: { name: 'Ichor', col: '#8fe8ff', desc: 'Blood of the gods. Spend it at the Rock between runs.' },
  ambrosia: { name: 'Ambrosia', col: '#ff7a8a', desc: 'Heal 40% of your health.' },
  ember: { name: 'Titan’s Ember', col: '#ff9a3a', desc: '+15 max health, and heal 15.' },
  anvil: { name: 'Anvil of Hephaestus', col: '#e0b060', desc: 'Your weapon deals +15% damage for the rest of the run.' },
};

// Permanent upgrades bought with ichor at the Altar on the Rock.
const UPGRADES = [
  { id: 'hp', name: 'Titan’s Flesh', desc: '+20 max health per rank.', costs: [40, 90, 160] },
  { id: 'dmg', name: 'Hotter Flame', desc: '+8% damage per rank.', costs: [60, 130, 220] },
  { id: 'heart', name: 'Regrowing Heart', desc: 'Once per run, your heart regrows: survive a killing blow with half health.', costs: [150] },
  { id: 'dash', name: 'Wings of Daedalus', desc: 'Dash twice before it needs to recover.', costs: [180] },
  { id: 'flame', name: 'Deeper Embers', desc: 'Start each run with a full flame meter and +25% flame from kills.', costs: [100] },
];

// ---------------------------------------------------------------- voices
const LINES = {
  epimetheus: {
    first: ['Brother! You broke the chains! And you stole the fire again? Of course you did.',
            'Listen: Tartarus is a maze of chambers. Each door shows what waits beyond it. Choose well.'],
    afterDeath: [
      'Back on the rock already? The eagle did not even have time to get hungry.',
      'You fell, I dragged you back. Family business.',
      'Hindsight is my gift, brother. Mine says: dodge more.',
      'Every time you die, the fire burns a little brighter. Or so I tell myself.',
      'Mother sent a message through the stones. She says eat something.',
    ],
    afterEagle: ['The eagle is dead? The EAGLE? Brother, the Titans will sing about this for an age.'],
    killer: {
      shade: 'Killed by a shade in chains. You of all people should know how to deal with chains.',
      eaglet: 'The eagle’s brood got you. Clearly the family resemblance is strong.',
      fist: 'The Hundred-Handed. They hold the gates of Tartarus. They are not fond of escapees.',
      warden: 'Hephaestus’ bronze wardens. He forged your chains too, remember.',
      lampad: 'The torch nymphs want the fire back. Do not let them near your hand.',
      eagle: 'The eagle. Of course. It knows exactly where your heart is.',
      lava: 'You fell in the lava. You are the Titan of fire, brother. Embarrassing.',
    },
  },
  eagle: {
    intro: ['You grew your heart back for me. How considerate.', 'Every day for five hundred years. Did you think I would let breakfast walk away?'],
    rage: ['I will carry your heart to Zeus myself!', 'Enough! I will pick you clean!'],
    death: ['Zeus... will send... another...'],
  },
  zeusMock: [
    'Somewhere far above, Zeus is laughing. Listen. You can hear it from here.',
    'Every god on Olympus saw that. They are still clapping.',
    'The king of the gods says: nice try.',
  ],
};
