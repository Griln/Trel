import type { DrawSkin } from '../generate-skins';

// Skin 046: Sunforge Paladin
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Sunforge Paladin; 2) theme=fantasy; 3) gender=male; 4) personal design for knights, druids and rangers.
export default function skin046(draw: DrawSkin) {
  draw({
  id: "m-fantasy-sunforge-paladin",
  name: "Sunforge Paladin",
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
    238,
    210,
    165,
    255
  ],
  base: [
    54,
    112,
    62,
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
  outfit: 4,
  hairStyle: 4,
  accessory: 4,
  motif: 4,
  face: 1,
  seed: 7401
});
}
