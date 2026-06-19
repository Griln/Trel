import type { DrawSkin } from '../generate-skins';

// Skin 107: Boba Berry Nurse
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Boba Berry Nurse; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin107(draw: DrawSkin) {
  draw({
  id: "f-pastel-boba-berry-nurse",
  name: "Boba Berry Nurse",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
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
    240,
    226,
    210,
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
  outfit: 3,
  hairStyle: 2,
  accessory: 4,
  motif: 2,
  face: 5,
  seed: 16558
});
}
