import type { DrawSkin } from '../generate-skins';

// Skin 119: Vanilla Rain Dancer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Vanilla Rain Dancer; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin119(draw: DrawSkin) {
  draw({
  id: "f-pastel-vanilla-rain-dancer",
  name: "Vanilla Rain Dancer",
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
    190,
    70,
    85,
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
    150,
    230,
    255,
    255
  ],
  outfit: 6,
  hairStyle: 2,
  accessory: 4,
  motif: 6,
  face: 5,
  seed: 18439
});
}
