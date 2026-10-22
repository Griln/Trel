import React, { useEffect, useRef } from 'react';

interface FaceProps {
  /** PNG data-URL of the skin or null. If null — a placeholder is drawn. */
  skin: string | null;
  /** Avatar size in css pixels. Every skin pixel is scaled up to size/8. */
  size?: number;
  /** Name used for the placeholder initial, if no skin is loaded. */
  fallbackName?: string;
  /** Extra class name. */
  className?: string;
}

/**
 * Draws the player FACE (8×8 pixels from the base layer + 8×8 hat) on a canvas.
 * Compatible with the modern 64×64 format and the legacy 64×32 one.
 *
 * Used in the header/sidebar/account card instead of a letter initial.
 */
export const SkinFace: React.FC<FaceProps> = ({ skin, size = 32, fallbackName = '?', className }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !skin) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);
      // Face base: src (8,8) → (16,16)
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
      // Hat layer: src (40,8) → (48,16)
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
    };
    img.src = skin;
  }, [skin, size]);

  if (!skin) {
    // Fallback: a colored square with the first letter of the name.
    return (
      <div
        className={'skin-face-fallback ' + (className ?? '')}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      >
        {fallbackName.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={'skin-face ' + (className ?? '')}
      style={{ width: size, height: size }}
    />
  );
};

interface BodyProps {
  skin: string;
  /** Model style: 4-pixel arms (Steve) or 3-pixel arms (Alex). */
  model?: 'classic' | 'slim';
  /** Preview height in css pixels; the width is computed proportionally. */
  height?: number;
  className?: string;
}

/**
 * Draws a 2D full-body character layout (front view):
 * head + body + arms + legs, with the second layers. 16×32 “skin” pixels
 * match the frame size: height 32 → width 16.
 */
export const SkinBody: React.FC<BodyProps> = ({ skin, model = 'classic', height = 192, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const armW = model === 'slim' ? 3 : 4;
  // Frame: 16 “skin” pixels wide. Height 32. Aspect ratio 1:2.
  const w = (height * 16) / 32;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, height);
      const px = height / 32;

      // All coordinates — in skin pixels (UV).
      // Base layers:
      // Head     src (8,8)  8×8     → dst (4,0) 8×8
      // Body     src (20,20) 8×12   → dst (4,8) 8×12
      // Right arm  src (44,20) 4×12 → dst (12,8) armW×12
      // Left arm   (mirror or 64×64)
      // Right leg  src (4,20) 4×12 → dst (4,20) 4×12
      // Left leg   (mirror or 64×64)

      const draw = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
        ctx.drawImage(img, sx, sy, sw, sh, dx * px, dy * px, dw * px, dh * px);
      };

      const drawMirror = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) => {
        // Mirror horizontally through a temporary canvas
        const tmp = document.createElement('canvas');
        tmp.width = sw;
        tmp.height = sh;
        const tctx = tmp.getContext('2d')!;
        tctx.imageSmoothingEnabled = false;
        tctx.translate(sw, 0);
        tctx.scale(-1, 1);
        tctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        ctx.drawImage(tmp, 0, 0, sw, sh, dx * px, dy * px, dw * px, dh * px);
      };

      const is64x64 = img.height >= 64;

      // === Head ===
      draw(8, 8, 8, 8, 4, 0, 8, 8);
      draw(40, 8, 8, 8, 4, 0, 8, 8); // hat

      // === Body ===
      draw(20, 20, 8, 12, 4, 8, 8, 12);
      if (is64x64) draw(20, 36, 8, 12, 4, 8, 8, 12); // body 2nd layer

      // === Right arm (from the player's point of view — our left on screen) ===
      draw(44, 20, armW, 12, 12, 8, armW, 12);
      if (is64x64) draw(44, 36, armW, 12, 12, 8, armW, 12); // 2nd layer

      // === Left arm ===
      if (is64x64) {
        // 64×64: its own UV (36,52)
        draw(36, 52, armW, 12, 4 - armW, 8, armW, 12);
        draw(52, 52, armW, 12, 4 - armW, 8, armW, 12); // 2nd layer
      } else {
        // 64×32 legacy: mirror the right one
        drawMirror(44, 20, armW, 12, 4 - armW, 8, armW, 12);
      }

      // === Right leg ===
      draw(4, 20, 4, 12, 8, 20, 4, 12);
      if (is64x64) draw(4, 36, 4, 12, 8, 20, 4, 12); // 2nd layer

      // === Left leg ===
      if (is64x64) {
        draw(20, 52, 4, 12, 4, 20, 4, 12);
        draw(4, 52, 4, 12, 4, 20, 4, 12); // 2nd layer
      } else {
        drawMirror(4, 20, 4, 12, 4, 20, 4, 12);
      }
    };
    img.src = skin;
  }, [skin, model, w, height]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={height}
      className={'skin-body ' + (className ?? '')}
      style={{ width: w, height }}
    />
  );
};
