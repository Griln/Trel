import type { DrawSkin } from '../generate-skins';

// Skin 050: Void Ember Squire
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Void Ember Squire; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin050(draw: DrawSkin) {
  draw({
  id: "m-fantasy-void-ember-squire",
  name: "Void Ember Squire",
  category: "male",
  style: "fantasy",
  model: "classic",
  comboTitle: "fantasy-male",
  vibe: "knights, druids and rangers",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    190,
    70,
    85,
    255
  ],
  base: [
    95,
    45,
    64,
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
  outfit: 8,
  hairStyle: 4,
  accessory: 0,
  motif: 0,
  face: 5,
  seed: 8028
});
}
