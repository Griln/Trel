import type { DrawSkin } from '../generate-skins';

// Skin 059: Sapphire Cave Ranger
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Sapphire Cave Ranger; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin059(draw: DrawSkin) {
  draw({
  id: "m-fantasy-sapphire-cave-ranger",
  name: "Sapphire Cave Ranger",
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
    40,
    170,
    160,
    255
  ],
  base: [
    38,
    58,
    92,
    255
  ],
  accent: [
    80,
    220,
    120,
    255
  ],
  second: [
    255,
    170,
    90,
    255
  ],
  outfit: 8,
  hairStyle: 7,
  accessory: 9,
  motif: 15,
  face: 2,
  seed: 9462
});
}
