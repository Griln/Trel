import type { DrawSkin } from '../generate-skins';

// Skin 135: Mochi Rain Keeper
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Mochi Rain Keeper; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin135(draw: DrawSkin) {
  draw({
  id: "n-pastel-mochi-rain-keeper",
  name: "Mochi Rain Keeper",
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
    190,
    70,
    85,
    255
  ],
  base: [
    240,
    226,
    210,
    255
  ],
  accent: [
    150,
    230,
    255,
    255
  ],
  second: [
    255,
    145,
    205,
    255
  ],
  outfit: 2,
  hairStyle: 9,
  accessory: 1,
  motif: 1,
  face: 3,
  seed: 20778
});
}
