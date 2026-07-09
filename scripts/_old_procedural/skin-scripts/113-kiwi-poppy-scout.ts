import type { DrawSkin } from '../generate-skins';

// Skin 113: Kiwi Poppy Scout
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Kiwi Poppy Scout; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin113(draw: DrawSkin) {
  draw({
  id: "f-pastel-kiwi-poppy-scout",
  name: "Kiwi Poppy Scout",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    250,
    235,
    195,
    255
  ],
  accent: [
    255,
    145,
    205,
    255
  ],
  second: [
    210,
    175,
    255,
    255
  ],
  outfit: 0,
  hairStyle: 8,
  accessory: 10,
  motif: 12,
  face: 5,
  seed: 17452
});
}
