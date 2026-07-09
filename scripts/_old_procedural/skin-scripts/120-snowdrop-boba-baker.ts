import type { DrawSkin } from '../generate-skins';

// Skin 120: Snowdrop Boba Baker
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Snowdrop Boba Baker; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin120(draw: DrawSkin) {
  draw({
  id: "f-pastel-snowdrop-boba-baker",
  name: "Snowdrop Boba Baker",
  category: "female",
  style: "pastel",
  model: "slim",
  comboTitle: "pastel-female",
  vibe: "cute bakers, idols and dreamy artists",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    238,
    210,
    165,
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
  outfit: 7,
  hairStyle: 5,
  accessory: 9,
  motif: 13,
  face: 0,
  seed: 18588
});
}
