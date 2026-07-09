import type { DrawSkin } from '../generate-skins';

// Skin 067: Copper Meadow Bard
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Copper Meadow Bard; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin067(draw: DrawSkin) {
  draw({
  id: "f-fantasy-copper-meadow-bard",
  name: "Copper Meadow Bard",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    76,
    66,
    142,
    255
  ],
  accent: [
    120,
    205,
    255,
    255
  ],
  second: [
    80,
    220,
    120,
    255
  ],
  outfit: 5,
  hairStyle: 2,
  accessory: 2,
  motif: 2,
  face: 4,
  seed: 10609
});
}
