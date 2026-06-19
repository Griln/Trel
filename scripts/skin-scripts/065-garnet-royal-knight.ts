import type { DrawSkin } from '../generate-skins';

// Skin 065: Garnet Royal Knight
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Garnet Royal Knight; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin065(draw: DrawSkin) {
  draw({
  id: "f-fantasy-garnet-royal-knight",
  name: "Garnet Royal Knight",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    238,
    210,
    165,
    255
  ],
  base: [
    92,
    62,
    38,
    255
  ],
  accent: [
    255,
    170,
    90,
    255
  ],
  second: [
    120,
    205,
    255,
    255
  ],
  outfit: 3,
  hairStyle: 8,
  accessory: 4,
  motif: 4,
  face: 2,
  seed: 10342
});
}
