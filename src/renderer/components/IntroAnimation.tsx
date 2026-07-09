import React, { useEffect, useRef } from 'react';

interface Props {
  theme: string;
  onDone: () => void;
}

export const IntroAnimation: React.FC<Props> = ({ theme, onDone }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prevBodyPE = document.body.style.pointerEvents;
    document.body.style.pointerEvents = 'none';
    if (el) el.style.pointerEvents = 'auto';

    const t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
    const handler = () => {
      document.body.style.pointerEvents = prevBodyPE;
      onDone();
    };
    el.addEventListener('transitionend', handler, { once: true });
    return () => {
      document.body.style.pointerEvents = prevBodyPE;
      el.removeEventListener('transitionend', handler);
      clearTimeout(t);
    };
  }, [onDone]);

  return (
    <div
      ref={ref}
      className={`intro-overlay intro-${theme}`}
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {theme === 'mono' && <MonoIntro />}
      {theme === 'eclipse' && <EclipseIntro />}
      {theme === 'voxel' && <VoxelIntro />}
    </div>
  );
};

/** Mono — чистый кинетический текст: буквы выезжают слева с нарастающей скоростью. */
const MonoIntro: React.FC = () => (
  <div className="intro-mono-inner">
    <div className="mono-track">
      <span className="mono-word">Trel</span>
    </div>
  </div>
);

/** Eclipse — кольцо расходится, текст проявляется внутри с масштабированием. */
const EclipseIntro: React.FC = () => (
  <div className="intro-eclipse-inner">
    <div className="eclipse-ring" />
    <div className="eclipse-ring-2" />
    <span className="eclipse-word">Trel</span>
  </div>
);

/** Voxel — буквы выпрыгивают с баунсом, зелёные искры. */
const VoxelIntro: React.FC = () => {
  const letters = 'Trel'.split('');
  const particles = Array.from({ length: 14 }).map(() => ({
    sx: (Math.random() - 0.5) * 140,
    sy: (Math.random() - 0.5) * 140 - 30,
  }));
  return (
    <div className="intro-voxel-inner">
      <div className="voxel-particles">
        {particles.map((p, i) => (
          <span key={i} className="voxel-particle" style={{
            animationDelay: `${0.3 + i * 0.08}s`,
            left: `${20 + Math.random() * 60}%`,
            top: `${15 + Math.random() * 70}%`,
            '--sx': `${p.sx}px`,
            '--sy': `${p.sy}px`,
          } as React.CSSProperties} />
        ))}
      </div>
      <div className="voxel-text-row">
        {letters.map((ch, i) => (
          <span key={i} className="voxel-char" style={{ animationDelay: `${0.2 + i * 0.11}s` }}>
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
};