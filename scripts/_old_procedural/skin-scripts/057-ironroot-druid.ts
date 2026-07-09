import type { DrawSkin } from '../generate-skins';

// Skin 057: Ironroot Druid
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ironroot Druid; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin057(draw: DrawSkin) {
  draw({
  id: "m-fantasy-ironroot-druid",
  name: "Ironroot Druid",
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
    190,
    70,
    85,
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
    140,
    235,
    180,
    255
  ],
  outfit: 6,
  hairStyle: 1,
  accessory: 11,
  motif: 1,
  face: 0,
  seed: 8978
});
}
