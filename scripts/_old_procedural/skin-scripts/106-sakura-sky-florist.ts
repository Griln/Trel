import type { DrawSkin } from '../generate-skins';

// Skin 106: Sakura Sky Florist
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Sakura Sky Florist; 2) theme=pastel; 3) gender=female; 4) personal design for cute bakers, idols and dreamy artists.
export default function skin106(draw: DrawSkin) {
  draw({
  id: "f-pastel-sakura-sky-florist",
  name: "Sakura Sky Florist",
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
    235,
    120,
    190,
    255
  ],
  base: [
    210,
    235,
    255,
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
  outfit: 2,
  hairStyle: 11,
  accessory: 11,
  motif: 11,
  face: 4,
  seed: 16471
});
}
