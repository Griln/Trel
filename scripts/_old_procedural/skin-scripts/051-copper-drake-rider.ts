import type { DrawSkin } from '../generate-skins';

// Skin 051: Copper Drake Rider
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Copper Drake Rider; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin051(draw: DrawSkin) {
  draw({
  id: "m-fantasy-copper-drake-rider",
  name: "Copper Drake Rider",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    224,
    181,
    145,
    255
  ],
  hair: [
    38,
    27,
    28,
    255
  ],
  base: [
    38,
    58,
    92,
    255
  ],
  accent: [
    140,
    235,
    180,
    255
  ],
  second: [
    120,
    205,
    255,
    255
  ],
  outfit: 0,
  hairStyle: 7,
  accessory: 5,
  motif: 7,
  face: 0,
  seed: 8208
});
}
