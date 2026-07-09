import type { DrawSkin } from '../generate-skins';

// Skin 002: Volt Chrome Runner
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Volt Chrome Runner; 2) theme=cyber; 3) gender=male; 4) personal design for tactical neon runners.
export default function skin002(draw: DrawSkin) {
  draw({
  id: "m-cyber-volt-chrome-runner",
  name: "Volt Chrome Runner",
  category: "male",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-male",
  vibe: "tactical neon runners",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    86,
    55,
    35,
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
    55,
    190,
    255
  ],
  second: [
    170,
    95,
    255,
    255
  ],
  outfit: 2,
  hairStyle: 4,
  accessory: 6,
  motif: 8,
  face: 2,
  seed: 856
});
}
