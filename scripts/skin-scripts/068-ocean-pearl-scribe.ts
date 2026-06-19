import type { DrawSkin } from '../generate-skins';

// Skin 068: Ocean Pearl Scribe
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ocean Pearl Scribe; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin068(draw: DrawSkin) {
  draw({
  id: "f-fantasy-ocean-pearl-scribe",
  name: "Ocean Pearl Scribe",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    132,
    76,
    48,
    255
  ],
  accent: [
    205,
    160,
    255,
    255
  ],
  second: [
    205,
    160,
    255,
    255
  ],
  outfit: 6,
  hairStyle: 5,
  accessory: 7,
  motif: 9,
  face: 5,
  seed: 10758
});
}
