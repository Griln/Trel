import type { DrawSkin } from '../generate-skins';

// Skin 069: Sunlit Swan Mage
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Sunlit Swan Mage; 2) theme=fantasy; 3) gender=female; 4) personal design for oracles, mages and woodland guards.
export default function skin069(draw: DrawSkin) {
  draw({
  id: "f-fantasy-sunlit-swan-mage",
  name: "Sunlit Swan Mage",
  category: "female",
  style: "fantasy",
  model: "slim",
  comboTitle: "fantasy-female",
  vibe: "oracles, mages and woodland guards",
  skin: [
    240,
    202,
    170,
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
  outfit: 7,
  hairStyle: 8,
  accessory: 0,
  motif: 0,
  face: 0,
  seed: 10845
});
}
