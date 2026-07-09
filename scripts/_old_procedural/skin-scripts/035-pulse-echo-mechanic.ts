import type { DrawSkin } from '../generate-skins';

// Skin 035: Pulse Echo Mechanic
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Pulse Echo Mechanic; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin035(draw: DrawSkin) {
  draw({
  id: "n-cyber-pulse-echo-mechanic",
  name: "Pulse Echo Mechanic",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    232,
    208,
    188,
    255
  ],
  hair: [
    190,
    70,
    85,
    255
  ],
  base: [
    18,
    48,
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
  outfit: 4,
  hairStyle: 9,
  accessory: 5,
  motif: 5,
  face: 5,
  seed: 5838
});
}
