import type { DrawSkin } from '../generate-skins';

// Skin 108: Lilac Star Skater
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Lilac Star Skater; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin108(draw: DrawSkin) {
  draw({
  id: "f-pastel-lilac-star-skater",
  name: "Lilac Star Skater",
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
    112,
    52,
    140,
    255
  ],
  base: [
    228,
    246,
    255,
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
  outfit: 4,
  hairStyle: 5,
  accessory: 9,
  motif: 9,
  face: 0,
  seed: 16738
});
}
