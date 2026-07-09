import type { DrawSkin } from '../generate-skins';

// Skin 016: Aurora Byte Witch
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Aurora Byte Witch; 2) theme=cyber; 3) gender=female; 4) personal design for glitch idols and neon operators.
export default function skin016(draw: DrawSkin) {
  draw({
  id: "f-cyber-aurora-byte-witch",
  name: "Aurora Byte Witch",
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
    52,
    52,
    70,
    255
  ],
  base: [
    45,
    45,
    52,
    255
  ],
  accent: [
    90,
    255,
    105,
    255
  ],
  second: [
    170,
    95,
    255,
    255
  ],
  outfit: 5,
  hairStyle: 5,
  accessory: 5,
  motif: 5,
  face: 4,
  seed: 2928
});
}
