import type { DrawSkin } from '../generate-skins';

// Skin 118: Melon Soft Ranger
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Melon Soft Ranger; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin118(draw: DrawSkin) {
  draw({
  id: "f-pastel-melon-soft-ranger",
  name: "Melon Soft Ranger",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    235,
    220,
    255,
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
  outfit: 5,
  hairStyle: 11,
  accessory: 11,
  motif: 15,
  face: 4,
  seed: 18228
});
}
