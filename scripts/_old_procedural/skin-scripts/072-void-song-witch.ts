import type { DrawSkin } from '../generate-skins';

// Skin 072: Void Song Witch
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Void Song Witch; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin072(draw: DrawSkin) {
  draw({
  id: "f-fantasy-void-song-witch",
  name: "Void Song Witch",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    120,
    94,
    44,
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
  outfit: 1,
  hairStyle: 5,
  accessory: 3,
  motif: 5,
  face: 3,
  seed: 11261
});
}
