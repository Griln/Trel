import type { DrawSkin } from '../generate-skins';

// Skin 085: Twilight Fern Mage
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Twilight Fern Mage; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin085(draw: DrawSkin) {
  draw({
  id: "n-fantasy-twilight-fern-mage",
  name: "Twilight Fern Mage",
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
    190,
    70,
    85,
    255
  ],
  base: [
    92,
    62,
    38,
    255
  ],
  accent: [
    120,
    205,
    255,
    255
  ],
  second: [
    140,
    235,
    180,
    255
  ],
  outfit: 3,
  hairStyle: 3,
  accessory: 9,
  motif: 11,
  face: 4,
  seed: 13308
});
}
