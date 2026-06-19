import type { DrawSkin } from '../generate-skins';

// Skin 127: Lemon Pillow Scout
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Lemon Pillow Scout; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin127(draw: DrawSkin) {
  draw({
  id: "n-pastel-lemon-pillow-scout",
  name: "Lemon Pillow Scout",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    240,
    226,
    210,
    255
  ],
  accent: [
    175,
    210,
    255,
    255
  ],
  second: [
    210,
    175,
    255,
    255
  ],
  outfit: 3,
  hairStyle: 9,
  accessory: 9,
  motif: 9,
  face: 1,
  seed: 19617
});
}
