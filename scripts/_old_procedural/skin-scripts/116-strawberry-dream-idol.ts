import type { DrawSkin } from '../generate-skins';

// Skin 116: Strawberry Dream Idol
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Strawberry Dream Idol; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin116(draw: DrawSkin) {
  draw({
  id: "f-pastel-strawberry-dream-idol",
  name: "Strawberry Dream Idol",
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
    70,
    86,
    125,
    255
  ],
  base: [
    228,
    246,
    255,
    255
  ],
  accent: [
    175,
    210,
    255,
    255
  ],
  second: [
    175,
    210,
    255,
    255
  ],
  outfit: 3,
  hairStyle: 5,
  accessory: 1,
  motif: 1,
  face: 2,
  seed: 18054
});
}
