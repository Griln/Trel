import type { DrawSkin } from '../generate-skins';

// Skin 042: Quantum Dust Pilot
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Quantum Dust Pilot; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin042(draw: DrawSkin) {
  draw({
  id: "n-cyber-quantum-dust-pilot",
  name: "Quantum Dust Pilot",
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
    238,
    210,
    165,
    255
  ],
  base: [
    30,
    24,
    58,
    255
  ],
  accent: [
    255,
    175,
    40,
    255
  ],
  second: [
    80,
    160,
    255,
    255
  ],
  outfit: 2,
  hairStyle: 6,
  accessory: 4,
  motif: 6,
  face: 0,
  seed: 6850
});
}
