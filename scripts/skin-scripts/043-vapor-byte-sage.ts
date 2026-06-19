import type { DrawSkin } from '../generate-skins';

// Skin 043: Vapor Byte Sage
// Upgrade pass: improved theme silhouette, accessories, motifs and palette depth.
// Rule plan: 1) name=Vapor Byte Sage; 2) theme=cyber; 3) gender=neutral; 4) personal design for masked synth ghosts.
export default function skin043(draw: DrawSkin) {
  draw({
  id: "n-cyber-vapor-byte-sage",
  name: "Vapor Byte Sage",
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
    52,
    52,
    70,
    255
  ],
  base: [
    18,
    48,
    58,
    255
  ],
  accent: [
    80,
    160,
    255,
    255
  ],
  second: [
    90,
    255,
    105,
    255
  ],
  outfit: 3,
  hairStyle: 9,
  accessory: 9,
  motif: 13,
  face: 1,
  seed: 6906
});
}
