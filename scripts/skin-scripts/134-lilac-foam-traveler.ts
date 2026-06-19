import type { DrawSkin } from '../generate-skins';

// Skin 134: Lilac Foam Traveler
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Lilac Foam Traveler; 2) theme=pastel; 3) gender=neutral; 4) personal design for plush, dreamy and gentle mascots.
export default function skin134(draw: DrawSkin) {
  draw({
  id: "n-pastel-lilac-foam-traveler",
  name: "Lilac Foam Traveler",
  category: "neutral",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-neutral",
  vibe: "plush, dreamy and gentle mascots",
  skin: [
    240,
    202,
    170,
    255
  ],
  hair: [
    190,
    70,
    85,
    255
  ],
  base: [
    210,
    235,
    255,
    255
  ],
  accent: [
    175,
    210,
    255,
    255
  ],
  second: [
    210,
    175,
    255,
    255
  ],
  outfit: 1,
  hairStyle: 6,
  accessory: 8,
  motif: 10,
  face: 2,
  seed: 20691
});
}
