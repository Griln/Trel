import type { DrawSkin } from '../generate-skins';

// Skin 117: Moon Pearl Painter
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Moon Pearl Painter; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin117(draw: DrawSkin) {
  draw({
  id: "f-pastel-moon-pearl-painter",
  name: "Moon Pearl Painter",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    173,
    118,
    78,
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
    235,
    145,
    255
  ],
  outfit: 4,
  hairStyle: 8,
  accessory: 6,
  motif: 8,
  face: 3,
  seed: 18110
});
}
