import type { DrawSkin } from '../generate-skins';

// Skin 074: Ivy Moon Ranger
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ivy Moon Ranger; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin074(draw: DrawSkin) {
  draw({
  id: "f-fantasy-ivy-moon-ranger",
  name: "Ivy Moon Ranger",
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
    218,
    175,
    95,
    255
  ],
  base: [
    54,
    112,
    62,
    255
  ],
  accent: [
    120,
    205,
    255,
    255
  ],
  second: [
    80,
    220,
    120,
    255
  ],
  outfit: 3,
  hairStyle: 11,
  accessory: 1,
  motif: 3,
  face: 5,
  seed: 11559
});
}
