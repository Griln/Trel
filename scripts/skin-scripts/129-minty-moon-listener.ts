import type { DrawSkin } from '../generate-skins';

// Skin 129: Minty Moon Listener
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Minty Moon Listener; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin129(draw: DrawSkin) {
  draw({
  id: "n-pastel-minty-moon-listener",
  name: "Minty Moon Listener",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    246,
    219,
    190,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    255,
    226,
    210,
    255
  ],
  accent: [
    180,
    250,
    205,
    255
  ],
  second: [
    180,
    250,
    205,
    255
  ],
  outfit: 5,
  hairStyle: 3,
  accessory: 7,
  motif: 7,
  face: 3,
  seed: 19946
});
}
