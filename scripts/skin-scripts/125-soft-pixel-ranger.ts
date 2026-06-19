import type { DrawSkin } from '../generate-skins';

// Skin 125: Soft Pixel Ranger
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Soft Pixel Ranger; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin125(draw: DrawSkin) {
  draw({
  id: "n-pastel-soft-pixel-ranger",
  name: "Soft Pixel Ranger",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    238,
    210,
    165,
    255
  ],
  base: [
    250,
    235,
    195,
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
    185,
    150,
    255
  ],
  outfit: 1,
  hairStyle: 3,
  accessory: 11,
  motif: 11,
  face: 5,
  seed: 19288
});
}
