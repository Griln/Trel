import type { DrawSkin } from '../generate-skins';

// Skin 097: Berry Soft Coder
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Berry Soft Coder; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin097(draw: DrawSkin) {
  draw({
  id: "m-pastel-berry-soft-coder",
  name: "Berry Soft Coder",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    255,
    226,
    210,
    255
  ],
  accent: [
    210,
    175,
    255,
    255
  ],
  second: [
    255,
    185,
    150,
    255
  ],
  outfit: 4,
  hairStyle: 1,
  accessory: 1,
  motif: 1,
  face: 1,
  seed: 15051
});
}
