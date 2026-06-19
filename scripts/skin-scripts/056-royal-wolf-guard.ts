import type { DrawSkin } from '../generate-skins';

// Skin 056: Royal Wolf Guard
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Royal Wolf Guard; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin056(draw: DrawSkin) {
  draw({
  id: "m-fantasy-royal-wolf-guard",
  name: "Royal Wolf Guard",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    190,
    70,
    85,
    255
  ],
  base: [
    132,
    76,
    48,
    255
  ],
  accent: [
    120,
    205,
    255,
    255
  ],
  second: [
    230,
    86,
    78,
    255
  ],
  outfit: 5,
  hairStyle: 10,
  accessory: 6,
  motif: 10,
  face: 5,
  seed: 8891
});
}
