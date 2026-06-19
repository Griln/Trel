import type { DrawSkin } from '../generate-skins';

// Skin 060: Obsidian Crown Hero
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Obsidian Crown Hero; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin060(draw: DrawSkin) {
  draw({
  id: "m-fantasy-obsidian-crown-hero",
  name: "Obsidian Crown Hero",
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
    190,
    70,
    85,
    255
  ],
  base: [
    120,
    94,
    44,
    255
  ],
  accent: [
    230,
    86,
    78,
    255
  ],
  second: [
    80,
    220,
    120,
    255
  ],
  outfit: 0,
  hairStyle: 10,
  accessory: 2,
  motif: 6,
  face: 3,
  seed: 9580
});
}
