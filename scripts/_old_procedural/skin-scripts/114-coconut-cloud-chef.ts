import type { DrawSkin } from '../generate-skins';

// Skin 114: Coconut Cloud Chef
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Coconut Cloud Chef; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin114(draw: DrawSkin) {
  draw({
  id: "f-pastel-coconut-cloud-chef",
  name: "Coconut Cloud Chef",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    190,
    70,
    85,
    255
  ],
  base: [
    210,
    235,
    255,
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
    145,
    205,
    255
  ],
  outfit: 1,
  hairStyle: 11,
  accessory: 3,
  motif: 3,
  face: 0,
  seed: 17663
});
}
