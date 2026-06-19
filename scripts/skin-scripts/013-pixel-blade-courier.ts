import type { DrawSkin } from '../generate-skins';

// Skin 013: Pixel Blade Courier
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Pixel Blade Courier; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin013(draw: DrawSkin) {
  draw({
  id: "m-cyber-pixel-blade-courier",
  name: "Pixel Blade Courier",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    218,
    175,
    95,
    255
  ],
  base: [
    22,
    22,
    38,
    255
  ],
  accent: [
    255,
    175,
    40,
    255
  ],
  second: [
    255,
    55,
    190,
    255
  ],
  outfit: 4,
  hairStyle: 1,
  accessory: 1,
  motif: 5,
  face: 1,
  seed: 2526
});
}
