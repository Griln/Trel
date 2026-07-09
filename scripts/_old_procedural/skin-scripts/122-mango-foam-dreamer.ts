import type { DrawSkin } from '../generate-skins';

// Skin 122: Mango Foam Dreamer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Mango Foam Dreamer; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin122(draw: DrawSkin) {
  draw({
  id: "n-pastel-mango-foam-dreamer",
  name: "Mango Foam Dreamer",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    220,
    230,
    245,
    255
  ],
  base: [
    235,
    220,
    255,
    255
  ],
  accent: [
    180,
    250,
    205,
    255
  ],
  second: [
    180,
    250,
    205,
    255
  ],
  outfit: 7,
  hairStyle: 6,
  accessory: 8,
  motif: 6,
  face: 2,
  seed: 18872
});
}
