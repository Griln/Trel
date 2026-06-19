import type { DrawSkin } from '../generate-skins';

// Skin 076: Moss Lantern Spirit
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Moss Lantern Spirit; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin076(draw: DrawSkin) {
  draw({
  id: "n-fantasy-moss-lantern-spirit",
  name: "Moss Lantern Spirit",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    218,
    175,
    95,
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
    245,
    208,
    88,
    255
  ],
  outfit: 3,
  hairStyle: 0,
  accessory: 0,
  motif: 12,
  face: 1,
  seed: 11998
});
}
