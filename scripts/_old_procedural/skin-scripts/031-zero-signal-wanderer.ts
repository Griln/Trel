import type { DrawSkin } from '../generate-skins';

// Skin 031: Zero Signal Wanderer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Zero Signal Wanderer; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin031(draw: DrawSkin) {
  draw({
  id: "n-cyber-zero-signal-wanderer",
  name: "Zero Signal Wanderer",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    214,
    220,
    238,
    255
  ],
  hair: [
    86,
    55,
    35,
    255
  ],
  base: [
    52,
    26,
    60,
    255
  ],
  accent: [
    255,
    55,
    190,
    255
  ],
  second: [
    0,
    240,
    255,
    255
  ],
  outfit: 0,
  hairStyle: 9,
  accessory: 9,
  motif: 9,
  face: 1,
  seed: 5273
});
}
