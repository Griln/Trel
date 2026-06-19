import type { DrawSkin } from '../generate-skins';

// Skin 126: Vanilla Star Medic
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Vanilla Star Medic; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin126(draw: DrawSkin) {
  draw({
  id: "n-pastel-vanilla-star-medic",
  name: "Vanilla Star Medic",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    210,
    235,
    255,
    255
  ],
  accent: [
    210,
    175,
    255,
    255
  ],
  second: [
    150,
    230,
    255,
    255
  ],
  outfit: 2,
  hairStyle: 6,
  accessory: 4,
  motif: 2,
  face: 0,
  seed: 19468
});
}
