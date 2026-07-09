import type { DrawSkin } from '../generate-skins';

// Skin 133: Soda Pop Guardian
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Soda Pop Guardian; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin133(draw: DrawSkin) {
  draw({
  id: "n-pastel-soda-pop-guardian",
  name: "Soda Pop Guardian",
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
    70,
    86,
    125,
    255
  ],
  base: [
    250,
    235,
    195,
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
  outfit: 0,
  hairStyle: 3,
  accessory: 3,
  motif: 3,
  face: 1,
  seed: 20480
});
}
