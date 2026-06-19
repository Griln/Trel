import type { DrawSkin } from '../generate-skins';

// Skin 058: Cedar Star Duelist
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cedar Star Duelist; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin058(draw: DrawSkin) {
  draw({
  id: "m-fantasy-cedar-star-duelist",
  name: "Cedar Star Duelist",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    95,
    45,
    64,
    255
  ],
  accent: [
    140,
    235,
    180,
    255
  ],
  second: [
    120,
    205,
    255,
    255
  ],
  outfit: 7,
  hairStyle: 4,
  accessory: 4,
  motif: 8,
  face: 1,
  seed: 9251
});
}
