import type { DrawSkin } from '../generate-skins';

// Skin 071: Royal Muse Keeper
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Royal Muse Keeper; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin071(draw: DrawSkin) {
  draw({
  id: "f-fantasy-royal-muse-keeper",
  name: "Royal Muse Keeper",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    38,
    58,
    92,
    255
  ],
  accent: [
    230,
    86,
    78,
    255
  ],
  second: [
    140,
    235,
    180,
    255
  ],
  outfit: 0,
  hairStyle: 2,
  accessory: 10,
  motif: 14,
  face: 2,
  seed: 11174
});
}
