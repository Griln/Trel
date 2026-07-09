import type { DrawSkin } from '../generate-skins';

// Skin 062: Ember Willow Archer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ember Willow Archer; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin062(draw: DrawSkin) {
  draw({
  id: "f-fantasy-ember-willow-archer",
  name: "Ember Willow Archer",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    95,
    45,
    64,
    255
  ],
  accent: [
    140,
    235,
    180,
    255
  ],
  second: [
    245,
    208,
    88,
    255
  ],
  outfit: 0,
  hairStyle: 11,
  accessory: 1,
  motif: 15,
  face: 5,
  seed: 9895
});
}
