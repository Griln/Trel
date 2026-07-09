import type { DrawSkin } from '../generate-skins';

// Skin 115: Pudding Rose Poet
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Pudding Rose Poet; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin115(draw: DrawSkin) {
  draw({
  id: "f-pastel-pudding-rose-poet",
  name: "Pudding Rose Poet",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    240,
    226,
    210,
    255
  ],
  accent: [
    210,
    175,
    255,
    255
  ],
  second: [
    180,
    250,
    205,
    255
  ],
  outfit: 2,
  hairStyle: 2,
  accessory: 8,
  motif: 10,
  face: 1,
  seed: 17781
});
}
