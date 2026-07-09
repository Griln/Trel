import type { DrawSkin } from '../generate-skins';

// Skin 049: Mosswood Warden
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Mosswood Warden; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin049(draw: DrawSkin) {
  draw({
  id: "m-fantasy-mosswood-warden",
  name: "Mosswood Warden",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    42,
    78,
    58,
    255
  ],
  accent: [
    120,
    205,
    255,
    255
  ],
  second: [
    230,
    86,
    78,
    255
  ],
  outfit: 7,
  hairStyle: 1,
  accessory: 7,
  motif: 9,
  face: 4,
  seed: 7817
});
}
