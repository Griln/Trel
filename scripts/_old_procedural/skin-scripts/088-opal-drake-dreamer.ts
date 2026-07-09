import type { DrawSkin } from '../generate-skins';

// Skin 088: Opal Drake Dreamer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Opal Drake Dreamer; 2) theme=fantasy; 3) gender=neutral; 4) personal design for masked forest spirits and rune travelers.
export default function skin088(draw: DrawSkin) {
  draw({
  id: "n-fantasy-opal-drake-dreamer",
  name: "Opal Drake Dreamer",
  category: "neutral",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-neutral",
  vibe: "masked forest spirits and rune travelers",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    132,
    76,
    48,
    255
  ],
  accent: [
    80,
    220,
    120,
    255
  ],
  second: [
    80,
    220,
    120,
    255
  ],
  outfit: 6,
  hairStyle: 0,
  accessory: 0,
  motif: 0,
  face: 1,
  seed: 13755
});
}
