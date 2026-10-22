import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  /** PNG data-URL of the skin. */
  skin: string;
  /** classic = 4-pixel arms (Steve), slim = 3-pixel arms (Alex). */
  model?: 'classic' | 'slim';
  /** Preview height in css pixels. */
  height?: number;
  /** Preview width in css pixels. Defaults to height * 0.75. */
  width?: number;
  /** Enable a gentle auto-rotation when the user is not dragging the mouse. */
  autoRotate?: boolean;
  className?: string;
}

// ============================================================================
// Corner of the mini-craft geometry.
// Every body part — a BoxGeometry with UVs cut out of a 64×64 (or 64×32) PNG.
// Standard cube layout in the texture:
//
//     [Top  ][Bot   ]
//   [R][Front][L][Bk]
//
// where W = block width in pixels, H = height, D = depth.
// (u,v) — the coordinate of the top-left corner of the “unfold” in the PNG (top-left origin).
// ============================================================================

function setBoxUVs(
  geom: THREE.BoxGeometry,
  u: number,
  v: number,
  w: number,
  h: number,
  d: number,
  texW: number,
  texH: number,
) {
  const uv = geom.attributes.uv as THREE.BufferAttribute;
  const setFace = (
    faceIndex: number,
    x0: number,
    y0: number,
    fw: number,
    fh: number,
    mirror = false,
  ) => {
    const x1 = x0 + fw;
    const y1 = y0 + fh;
    // PNG top-left → WebGL UV (Y flipped): vTop = 1 - y0/texH, vBot = 1 - y1/texH.
    const uL = x0 / texW;
    const uR = x1 / texW;
    const vT = 1 - y0 / texH;
    const vB = 1 - y1 / texH;
    // BoxGeometry face — 4 vertices (top-left, top-right, bottom-left, bottom-right).
    // By default: (uL,vT) (uR,vT) (uL,vB) (uR,vB).
    const off = faceIndex * 4;
    if (!mirror) {
      uv.setXY(off + 0, uL, vT);
      uv.setXY(off + 1, uR, vT);
      uv.setXY(off + 2, uL, vB);
      uv.setXY(off + 3, uR, vB);
    } else {
      uv.setXY(off + 0, uR, vT);
      uv.setXY(off + 1, uL, vT);
      uv.setXY(off + 2, uR, vB);
      uv.setXY(off + 3, uL, vB);
    }
  };

  // Box face order in three.js: +X, -X, +Y, -Y, +Z, -Z
  //   +X = Left side (from the point of view of the cube viewer)
  //   -X = Right side
  //   +Y = Top
  //   -Y = Bottom
  //   +Z = Front
  //   -Z = Back
  //
  // In the PNG layout:
  //   Right side:  (u,         v+d), size d×h
  //   Front:       (u+d,       v+d), size w×h
  //   Left side:   (u+d+w,     v+d), size d×h
  //   Back:        (u+2d+w,    v+d), size w×h
  //   Top:         (u+d,       v),   size w×d
  //   Bottom:      (u+d+w,     v),   size w×d  (mirrored horizontally in MC)

  setFace(0, u + d + w, v + d, d, h);                 // +X = Left side of body part
  setFace(1, u, v + d, d, h);                         // -X = Right side
  setFace(2, u + d, v, w, d);                         // +Y = Top
  setFace(3, u + d + w, v, w, d, true);               // -Y = Bottom (mirrored)
  setFace(4, u + d, v + d, w, h);                     // +Z = Front
  setFace(5, u + 2 * d + w, v + d, w, h);             // -Z = Back

  uv.needsUpdate = true;
}

interface PartDef {
  w: number; h: number; d: number;
  u: number; v: number;
  /** Coordinates of the second layer in the PNG. null = the part has no second layer. */
  ovU: number | null; ovV: number | null;
  /** Center position in world coordinates (1 unit = 1 skin pixel). */
  pos: [number, number, number];
}

/** Layout for a modern 64×64 skin, classic arms (4 px). */
function partsClassic(): Record<string, PartDef> {
  return {
    head:  { w: 8, h: 8,  d: 8, u: 0,  v: 0,  ovU: 32, ovV: 0,  pos: [0,  10, 0] },
    body:  { w: 8, h: 12, d: 4, u: 16, v: 16, ovU: 16, ovV: 32, pos: [0,  0,  0] },
    armR:  { w: 4, h: 12, d: 4, u: 40, v: 16, ovU: 40, ovV: 32, pos: [-6, 0,  0] },
    armL:  { w: 4, h: 12, d: 4, u: 32, v: 48, ovU: 48, ovV: 48, pos: [ 6, 0,  0] },
    legR:  { w: 4, h: 12, d: 4, u: 0,  v: 16, ovU: 0,  ovV: 32, pos: [-2, -12, 0] },
    legL:  { w: 4, h: 12, d: 4, u: 16, v: 48, ovU: 0,  ovV: 48, pos: [ 2, -12, 0] },
  };
}

/** Layout for slim (3-px arms). */
function partsSlim(): Record<string, PartDef> {
  const p = partsClassic();
  p.armR = { w: 3, h: 12, d: 4, u: 40, v: 16, ovU: 40, ovV: 32, pos: [-5.5, 0, 0] };
  p.armL = { w: 3, h: 12, d: 4, u: 32, v: 48, ovU: 48, ovV: 48, pos: [ 5.5, 0, 0] };
  return p;
}

/** For legacy 64×32 the left arm/leg have no textures of their own — we mirror the right one. */
function isLegacy(img: HTMLImageElement): boolean {
  return img.height < 64;
}

export const SkinViewer3D: React.FC<Props> = ({
  skin, model = 'classic', height = 256, width, autoRotate = false, className,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    cleanup?: () => void;
    setSkin?: (s: string, m: 'classic' | 'slim') => void;
  }>({});

  // Scene initialization — once per component life-time.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = width ?? Math.round(height * 0.75);
    const h = height;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 1000);
    let camDist = 64;
    camera.position.set(0, 4, camDist);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Light: a soft ambient plus one directional light from the top-front, so that the face
    // and the chest are slightly brighter, while the back/bottom are muted. No harsh shadows.
    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 0.45);
    key.position.set(2, 6, 5);
    scene.add(key);

    const playerGroup = new THREE.Group();
    scene.add(playerGroup);

    // Texture — created via CanvasTexture, so that it can be re-drawn
    // when the skin changes without recreating the material.
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 64;
    texCanvas.height = 64;
    const texture = new THREE.CanvasTexture(texCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;

    const baseMat = new THREE.MeshLambertMaterial({ map: texture });
    const overlayMat = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Storage of the created meshes — so that the UVs can be recomputed when the model changes.
    type PartMesh = { base: THREE.Mesh; overlay?: THREE.Mesh; def: PartDef };
    const meshes: Record<string, PartMesh> = {};

    const buildParts = (layout: Record<string, PartDef>) => {
      // Dispose of the old ones
      for (const k of Object.keys(meshes)) {
        const m = meshes[k];
        playerGroup.remove(m.base);
        m.base.geometry.dispose();
        if (m.overlay) {
          playerGroup.remove(m.overlay);
          m.overlay.geometry.dispose();
        }
        delete meshes[k];
      }
      const TEX_W = 64;
      const TEX_H = 64;
      for (const [name, def] of Object.entries(layout)) {
        const geo = new THREE.BoxGeometry(def.w, def.h, def.d);
        setBoxUVs(geo, def.u, def.v, def.w, def.h, def.d, TEX_W, TEX_H);
        const base = new THREE.Mesh(geo, baseMat);
        base.position.set(def.pos[0], def.pos[1], def.pos[2]);
        playerGroup.add(base);

        let overlay: THREE.Mesh | undefined;
        if (def.ovU !== null && def.ovV !== null) {
          const inflate = name === 'head' ? 1.125 : 1.0625;
          const oGeo = new THREE.BoxGeometry(def.w * inflate, def.h * inflate, def.d * inflate);
          setBoxUVs(oGeo, def.ovU, def.ovV, def.w, def.h, def.d, TEX_W, TEX_H);
          overlay = new THREE.Mesh(oGeo, overlayMat);
          overlay.position.set(def.pos[0], def.pos[1], def.pos[2]);
          playerGroup.add(overlay);
        }

        meshes[name] = { base, overlay, def };
      }
      // Shift the whole group so that the waist sits at y=0 → the face is closer to the center of the frame.
      playerGroup.position.y = 2;
    };

    let currentModel: 'classic' | 'slim' = 'classic';
    buildParts(partsClassic());

    // Render-on-demand: running 60fps for nothing while the model is static
    // — wasted CPU/GPU and battery heating. A frame is drawn only when
    // something actually changed.
    let needsRender = true;
    const requestRender = () => { needsRender = true; };

    // ------------------------------------------------------------------------
    // Loading / updating the skin
    // ------------------------------------------------------------------------
    const applySkin = (src: string, mdl: 'classic' | 'slim') => {
      if (mdl !== currentModel) {
        currentModel = mdl;
        buildParts(mdl === 'slim' ? partsSlim() : partsClassic());
      }
      const img = new Image();
      img.onload = () => {
        const ctx = texCanvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 64, 64);
        if (isLegacy(img)) {
          ctx.drawImage(img, 0, 0);
          const mirrorRect = (sx: number, sy: number, dx: number, dy: number, sw = 16, sh = 16) => {
            ctx.save();
            ctx.translate(dx + sw, dy);
            ctx.scale(-1, 1);
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
            ctx.restore();
          };
          mirrorRect(40, 16, 32, 48);
          mirrorRect(0,  16, 16, 48);
        } else {
          ctx.drawImage(img, 0, 0);
        }
        texture.needsUpdate = true;
        requestRender();
      };
      img.onerror = () => { requestRender(); };
      img.src = src;
    };
    stateRef.current.setSkin = applySkin;
    applySkin(skin, model);

    // ------------------------------------------------------------------------
    // Controls: drag — rotation, wheel — zoom, auto-rotate when not dragging.
    // ------------------------------------------------------------------------
    let rotY = Math.PI * 0.0;
    let rotX = 0.1;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastInteract = performance.now();
    // (needsRender / requestRender are declared above — before applySkin)

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteract = performance.now();
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      rotY += dx * 0.01;
      rotX += dy * 0.01;
      // limit the vertical angle, so that we do not go “over the top”
      rotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, rotX));
      lastInteract = performance.now();
      needsRender = true;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camDist += e.deltaY * 0.05;
      camDist = Math.max(30, Math.min(140, camDist));
      lastInteract = performance.now();
      needsRender = true;
    };

    const dom = renderer.domElement;
    dom.style.touchAction = 'none';
    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', (e) => { dom.style.cursor = 'grabbing'; onDown(e); });
    dom.addEventListener('pointermove', onMove);
    const upGlobal = (e: PointerEvent) => { dom.style.cursor = 'grab'; onUp(e); };
    dom.addEventListener('pointerup', upGlobal);
    dom.addEventListener('pointercancel', upGlobal);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Render loop (render-on-demand)
    let raf = 0;
    let paused = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused) return;
      const now = performance.now();
      const autoActive = autoRotate && !dragging && now - lastInteract > 1500;
      if (autoActive) {
        rotY += 0.005;
        needsRender = true;
      }
      if (!needsRender) return;
      needsRender = false;
      playerGroup.rotation.x = rotX;
      playerGroup.rotation.y = rotY;
      camera.position.z = camDist;
      renderer.render(scene, camera);
    };
    tick();

    // When the tab is hidden — we stop rendering completely.
    // Chromium throttles rAF in a hidden window anyway, but an explicit pause saves even more.
    const onVis = () => {
      paused = document.hidden;
      if (!paused) needsRender = true;
    };
    document.addEventListener('visibilitychange', onVis);

    // Cleanup
    stateRef.current.cleanup = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      dom.removeEventListener('pointerdown', onDown as any);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', upGlobal);
      dom.removeEventListener('pointercancel', upGlobal);
      dom.removeEventListener('wheel', onWheel);
      for (const k of Object.keys(meshes)) {
        meshes[k].base.geometry.dispose();
        meshes[k].overlay?.geometry.dispose();
      }
      baseMat.dispose();
      overlayMat.dispose();
      texture.dispose();
      try { renderer.forceContextLoss(); } catch {}
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    };

    return () => stateRef.current.cleanup?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, width]);

  // When the skin or the model changes — re-apply it without recreating the scene.
  useEffect(() => {
    stateRef.current.setSkin?.(skin, model);
  }, [skin, model]);

  const w = width ?? Math.round(height * 0.75);
  return (
    <div
      ref={mountRef}
      className={'skin-viewer-3d ' + (className ?? '')}
      style={{ width: w, height, userSelect: 'none' }}
    />
  );
};
