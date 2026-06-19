import type { DrawSkin } from '../generate-skins';

// Skin 104: Lavender Rain Runner
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Lavender Rain Runner; 2) theme=pastel; 3) gender=male; 4) personal design for soft hoodies and candy skaters.
export default function skin104(draw: DrawSkin) {
  draw({
  id: "m-pastel-lavender-rain-runner",
  name: "Lavender Rain Runner",
  category: "male",
  style: "pastel",
  model: "classic",
  comboTitle: "pastel-male",
  vibe: "soft hoodies and candy skaters",
  skin: [
    126,
    83,
    58,
    255
  ],
  hair: [
    52,
    52,
    70,
    255
  ],
  base: [
    228,
    246,
    255,
    255
  ],
  accent: [
    210,
    175,
    255,
    255
  ],
  second: [
    255,
    185,
    150,
    255
  ],
  outfit: 2,
  hairStyle: 10,
  accessory: 0,
  motif: 2,
  face: 2,
  seed: 16218
});
}
