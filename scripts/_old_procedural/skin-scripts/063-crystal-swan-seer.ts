import type { DrawSkin } from '../generate-skins';

// Skin 063: Crystal Swan Seer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Crystal Swan Seer; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin063(draw: DrawSkin) {
  draw({
  id: "f-fantasy-crystal-swan-seer",
  name: "Crystal Swan Seer",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    38,
    58,
    92,
    255
  ],
  accent: [
    80,
    220,
    120,
    255
  ],
  second: [
    230,
    86,
    78,
    255
  ],
  outfit: 1,
  hairStyle: 2,
  accessory: 6,
  motif: 6,
  face: 0,
  seed: 9982
});
}
