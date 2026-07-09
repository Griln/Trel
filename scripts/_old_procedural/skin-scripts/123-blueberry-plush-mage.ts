import type { DrawSkin } from '../generate-skins';

// Skin 123: Blueberry Plush Mage
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Blueberry Plush Mage; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin123(draw: DrawSkin) {
  draw({
  id: "n-pastel-blueberry-plush-mage",
  name: "Blueberry Plush Mage",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    210,
    250,
    232,
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
  outfit: 8,
  hairStyle: 9,
  accessory: 1,
  motif: 13,
  face: 3,
  seed: 19083
});
}
