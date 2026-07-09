import type { DrawSkin } from '../generate-skins';

// Skin 111: Mint Cream Engineer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Mint Cream Engineer; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin111(draw: DrawSkin) {
  draw({
  id: "f-pastel-mint-cream-engineer",
  name: "Mint Cream Engineer",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    210,
    250,
    232,
    255
  ],
  accent: [
    180,
    250,
    205,
    255
  ],
  second: [
    255,
    185,
    150,
    255
  ],
  outfit: 7,
  hairStyle: 2,
  accessory: 0,
  motif: 14,
  face: 3,
  seed: 17247
});
}
