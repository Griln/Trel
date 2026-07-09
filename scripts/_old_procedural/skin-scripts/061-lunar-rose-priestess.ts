import type { DrawSkin } from '../generate-skins';

// Skin 061: Lunar Rose Priestess
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Lunar Rose Priestess; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin061(draw: DrawSkin) {
  draw({
  id: "f-fantasy-lunar-rose-priestess",
  name: "Lunar Rose Priestess",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    42,
    78,
    58,
    255
  ],
  accent: [
    205,
    160,
    255,
    255
  ],
  second: [
    205,
    160,
    255,
    255
  ],
  outfit: 8,
  hairStyle: 8,
  accessory: 8,
  motif: 8,
  face: 4,
  seed: 9777
});
}
