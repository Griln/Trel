import type { DrawSkin } from '../generate-skins';

// Skin 034: Holo Glass Nomad
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Holo Glass Nomad; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin034(draw: DrawSkin) {
  draw({
  id: "n-cyber-holo-glass-nomad",
  name: "Holo Glass Nomad",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    94,
    70,
    62,
    255
  ],
  hair: [
    235,
    120,
    190,
    255
  ],
  base: [
    30,
    24,
    58,
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
  outfit: 3,
  hairStyle: 6,
  accessory: 0,
  motif: 14,
  face: 4,
  seed: 5596
});
}
