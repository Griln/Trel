import type { DrawSkin } from '../generate-skins';

// Skin 040: Neon Ash Observer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Neon Ash Observer; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin040(draw: DrawSkin) {
  draw({
  id: "n-cyber-neon-ash-observer",
  name: "Neon Ash Observer",
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
    220,
    230,
    245,
    255
  ],
  base: [
    10,
    16,
    32,
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
  outfit: 0,
  hairStyle: 0,
  accessory: 6,
  motif: 8,
  face: 4,
  seed: 6521
});
}
