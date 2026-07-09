import type { DrawSkin } from '../generate-skins';

// Skin 132: Cloudberry Storyteller
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Cloudberry Storyteller; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin132(draw: DrawSkin) {
  draw({
  id: "n-pastel-cloudberry-storyteller",
  name: "Cloudberry Storyteller",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    40,
    170,
    160,
    255
  ],
  base: [
    255,
    220,
    235,
    255
  ],
  accent: [
    255,
    235,
    145,
    255
  ],
  second: [
    255,
    185,
    150,
    255
  ],
  outfit: 8,
  hairStyle: 0,
  accessory: 10,
  motif: 12,
  face: 0,
  seed: 20486
});
}
