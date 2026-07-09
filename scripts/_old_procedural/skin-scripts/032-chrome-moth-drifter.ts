import type { DrawSkin } from '../generate-skins';

// Skin 032: Chrome Moth Drifter
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Chrome Moth Drifter; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin032(draw: DrawSkin) {
  draw({
  id: "n-cyber-chrome-moth-drifter",
  name: "Chrome Moth Drifter",
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
    218,
    175,
    95,
    255
  ],
  base: [
    10,
    16,
    32,
    255
  ],
  accent: [
    170,
    95,
    255,
    255
  ],
  second: [
    255,
    175,
    40,
    255
  ],
  outfit: 1,
  hairStyle: 0,
  accessory: 2,
  motif: 0,
  face: 2,
  seed: 5391
});
}
