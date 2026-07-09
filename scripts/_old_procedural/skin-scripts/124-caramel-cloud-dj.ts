import type { DrawSkin } from '../generate-skins';

// Skin 124: Caramel Cloud DJ
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Caramel Cloud DJ; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin124(draw: DrawSkin) {
  draw({
  id: "n-pastel-caramel-cloud-dj",
  name: "Caramel Cloud DJ",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    255,
    220,
    235,
    255
  ],
  accent: [
    255,
    145,
    205,
    255
  ],
  second: [
    255,
    235,
    145,
    255
  ],
  outfit: 0,
  hairStyle: 0,
  accessory: 6,
  motif: 4,
  face: 4,
  seed: 19108
});
}
