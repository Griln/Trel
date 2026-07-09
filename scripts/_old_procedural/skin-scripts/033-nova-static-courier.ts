import type { DrawSkin } from '../generate-skins';

// Skin 033: Nova Static Courier
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Nova Static Courier; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin033(draw: DrawSkin) {
  draw({
  id: "n-cyber-nova-static-courier",
  name: "Nova Static Courier",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    154,
    96,
    64,
    255
  ],
  hair: [
    70,
    86,
    125,
    255
  ],
  base: [
    18,
    34,
    62,
    255
  ],
  accent: [
    255,
    80,
    80,
    255
  ],
  second: [
    255,
    80,
    80,
    255
  ],
  outfit: 2,
  hairStyle: 3,
  accessory: 7,
  motif: 7,
  face: 3,
  seed: 5540
});
}
