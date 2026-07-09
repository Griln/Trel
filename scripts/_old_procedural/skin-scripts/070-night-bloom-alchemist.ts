import type { DrawSkin } from '../generate-skins';

// Skin 070: Night Bloom Alchemist
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Night Bloom Alchemist; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin070(draw: DrawSkin) {
  draw({
  id: "f-fantasy-night-bloom-alchemist",
  name: "Night Bloom Alchemist",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    38,
    27,
    28,
    255
  ],
  base: [
    95,
    45,
    64,
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
  outfit: 8,
  hairStyle: 11,
  accessory: 5,
  motif: 7,
  face: 1,
  seed: 11149
});
}
