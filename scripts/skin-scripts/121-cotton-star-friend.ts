import type { DrawSkin } from '../generate-skins';

// Skin 121: Cotton Star Friend
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cotton Star Friend; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin121(draw: DrawSkin) {
  draw({
  id: "n-pastel-cotton-star-friend",
  name: "Cotton Star Friend",
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
    235,
    120,
    190,
    255
  ],
  base: [
    255,
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
  outfit: 6,
  hairStyle: 3,
  accessory: 3,
  motif: 15,
  face: 1,
  seed: 18723
});
}
