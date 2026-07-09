import type { DrawSkin } from '../generate-skins';

// Skin 038: Ion Mask Voyager
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Ion Mask Voyager; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin038(draw: DrawSkin) {
  draw({
  id: "n-cyber-ion-mask-voyager",
  name: "Ion Mask Voyager",
  category: "neutral",
  style: "cyber",
  model: "classic",
  comboTitle: "cyber-neutral",
  vibe: "masked synth ghosts",
  skin: [
    173,
    118,
    78,
    255
  ],
  hair: [
    38,
    27,
    28,
    255
  ],
  base: [
    8,
    28,
    38,
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
  outfit: 7,
  hairStyle: 6,
  accessory: 8,
  motif: 10,
  face: 2,
  seed: 6192
});
}
