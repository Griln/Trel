import type { DrawSkin } from '../generate-skins';

// Skin 110: Pearl Peach Student
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Pearl Peach Student; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin110(draw: DrawSkin) {
  draw({
  id: "f-pastel-pearl-peach-student",
  name: "Pearl Peach Student",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    235,
    220,
    255,
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
    235,
    145,
    255
  ],
  outfit: 6,
  hairStyle: 11,
  accessory: 7,
  motif: 7,
  face: 2,
  seed: 17098
});
}
