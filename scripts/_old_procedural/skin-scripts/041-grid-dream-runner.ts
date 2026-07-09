import type { DrawSkin } from '../generate-skins';

// Skin 041: Grid Dream Runner
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Grid Dream Runner; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin041(draw: DrawSkin) {
  draw({
  id: "n-cyber-grid-dream-runner",
  name: "Grid Dream Runner",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    18,
    34,
    62,
    255
  ],
  accent: [
    90,
    255,
    105,
    255
  ],
  second: [
    255,
    55,
    190,
    255
  ],
  outfit: 1,
  hairStyle: 3,
  accessory: 11,
  motif: 15,
  face: 5,
  seed: 6670
});
}
