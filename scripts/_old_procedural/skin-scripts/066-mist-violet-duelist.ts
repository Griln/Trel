import type { DrawSkin } from '../generate-skins';

// Skin 066: Mist Violet Duelist
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Mist Violet Duelist; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin066(draw: DrawSkin) {
  draw({
  id: "f-fantasy-mist-violet-duelist",
  name: "Mist Violet Duelist",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    54,
    112,
    62,
    255
  ],
  accent: [
    245,
    208,
    88,
    255
  ],
  second: [
    255,
    170,
    90,
    255
  ],
  outfit: 4,
  hairStyle: 11,
  accessory: 9,
  motif: 11,
  face: 3,
  seed: 10491
});
}
