import type { DrawSkin } from '../generate-skins';

// Skin 055: Bone Lantern Herald
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Bone Lantern Herald; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin055(draw: DrawSkin) {
  draw({
  id: "m-fantasy-bone-lantern-herald",
  name: "Bone Lantern Herald",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    76,
    66,
    142,
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
  outfit: 4,
  hairStyle: 7,
  accessory: 1,
  motif: 3,
  face: 4,
  seed: 8835
});
}
