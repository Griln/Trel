import type { DrawSkin } from '../generate-skins';

// Skin 025: Spark Data Engineer
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Spark Data Engineer; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin025(draw: DrawSkin) {
  draw({
  id: "f-cyber-spark-data-engineer",
  name: "Spark Data Engineer",
  category: "female",
  style: "cyber",
  model: "slim",
  comboTitle: "cyber-female",
  vibe: "glitch idols and neon operators",
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
    22,
    22,
    38,
    255
  ],
  accent: [
    80,
    160,
    255,
    255
  ],
  second: [
    255,
    175,
    40,
    255
  ],
  outfit: 5,
  hairStyle: 8,
  accessory: 2,
  motif: 4,
  face: 1,
  seed: 4331
});
}
