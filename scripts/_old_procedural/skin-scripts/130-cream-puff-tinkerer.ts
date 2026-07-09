import type { DrawSkin } from '../generate-skins';

// Skin 130: Cream Puff Tinkerer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cream Puff Tinkerer; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin130(draw: DrawSkin) {
  draw({
  id: "n-pastel-cream-puff-tinkerer",
  name: "Cream Puff Tinkerer",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    38,
    27,
    28,
    255
  ],
  base: [
    235,
    220,
    255,
    255
  ],
  accent: [
    255,
    185,
    150,
    255
  ],
  second: [
    175,
    210,
    255,
    255
  ],
  outfit: 6,
  hairStyle: 6,
  accessory: 0,
  motif: 14,
  face: 4,
  seed: 20095
});
}
