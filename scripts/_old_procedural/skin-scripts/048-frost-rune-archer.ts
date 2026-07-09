import type { DrawSkin } from '../generate-skins';

// Skin 048: Frost Rune Archer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Frost Rune Archer; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin048(draw: DrawSkin) {
  draw({
  id: "m-fantasy-frost-rune-archer",
  name: "Frost Rune Archer",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    132,
    76,
    48,
    255
  ],
  accent: [
    245,
    208,
    88,
    255
  ],
  second: [
    245,
    208,
    88,
    255
  ],
  outfit: 6,
  hairStyle: 10,
  accessory: 2,
  motif: 2,
  face: 3,
  seed: 7730
});
}
