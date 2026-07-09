import type { DrawSkin } from '../generate-skins';

// Skin 112: Latte Melody Artist
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Latte Melody Artist; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin112(draw: DrawSkin) {
  draw({
  id: "f-pastel-latte-melody-artist",
  name: "Latte Melody Artist",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    220,
    230,
    245,
    255
  ],
  base: [
    255,
    220,
    235,
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
  outfit: 8,
  hairStyle: 5,
  accessory: 5,
  motif: 5,
  face: 4,
  seed: 17396
});
}
