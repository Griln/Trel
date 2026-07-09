import type { DrawSkin } from '../generate-skins';

// Skin 109: Candy Moon Witch
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Candy Moon Witch; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin109(draw: DrawSkin) {
  draw({
  id: "f-pastel-candy-moon-witch",
  name: "Candy Moon Witch",
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
    40,
    170,
    160,
    255
  ],
  base: [
    255,
    226,
    210,
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
  outfit: 5,
  hairStyle: 8,
  accessory: 2,
  motif: 0,
  face: 1,
  seed: 16856
});
}
