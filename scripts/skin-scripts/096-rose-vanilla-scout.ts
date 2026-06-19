import type { DrawSkin } from '../generate-skins';

// Skin 096: Rose Vanilla Scout
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Rose Vanilla Scout; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin096(draw: DrawSkin) {
  draw({
  id: "m-pastel-rose-vanilla-scout",
  name: "Rose Vanilla Scout",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    228,
    246,
    255,
    255
  ],
  accent: [
    255,
    235,
    145,
    255
  ],
  second: [
    255,
    235,
    145,
    255
  ],
  outfit: 3,
  hairStyle: 10,
  accessory: 8,
  motif: 10,
  face: 0,
  seed: 14964
});
}
