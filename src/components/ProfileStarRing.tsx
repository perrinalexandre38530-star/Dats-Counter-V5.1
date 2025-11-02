// ============================================
// src/components/ProfileStarRing.tsx
// Couronne d’étoiles — dégradé jaune→rouge + violet final
// - 1★ / 10 pts (1..9 = dégradé jaune→rouge, 10 = violet clair)
// - ½★ aux seuils : 15/25/35/45/55/65/75/85/95
// - >100 : +1★ violette chaque +20 (120/140/160/180)
// - Centré à 12h, gapPx pour coller au médaillon
// ============================================

import React from "react";

type Props = {
  anchorSize: number;     // diamètre du médaillon
  avg3d?: number;         // moyenne 0..180
  starSize?: number;      // taille d’une étoile (px)
  gapPx?: number;         // distance depuis le bord du médaillon (px)
  stepDeg?: number;       // écart angulaire entre étoiles (°)
  rotationDeg?: number;   // rotation globale (°)
  animateGlow?: boolean;  // légère pulsation
};

type StarEntry = { color: string; half?: boolean };

/* --- Dégradé continu jaune → orange → rouge (1..9) + violet clair (10) --- */
const STAR_COLORS = [
  "#FFE873", // 1 jaune clair
  "#FFD95C", // 2 jaune
  "#FFC945", // 3 doré
  "#FFB733", // 4 or/ambre
  "#FFA22E", // 5 orange clair
  "#FF8A2F", // 6 orange soutenu
  "#FF6A3B", // 7 rouge-orangé
  "#FF504A", // 8 rouge
  "#FF3860", // 9 rouge vif
  "#D07CFF", // 10 violet clair
];

/* --- Étoile SVG --- */
function Star({
  size,
  color,
  half,
  animate,
}: {
  size: number;
  color: string;
  half?: boolean;
  animate?: boolean;
}) {
  const cls = animate ? "psr-pulse" : undefined;
  const path =
    "M50 5 L61 36 L94 38 L68 57 L77 88 L50 71 L23 88 L32 57 L6 38 L39 36 Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cls}
      style={{ filter: "url(#psrGlow)" }}
    >
      <defs>
        <filter id="psrGlow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="halfClip">
          <rect x="0" y="0" width="50" height="100" />
        </clipPath>
      </defs>
      {half ? (
        <>
          <path d={path} fill="rgba(255,255,255,0.15)" />
          <g clipPath="url(#halfClip)">
            <path d={path} fill={color} />
          </g>
        </>
      ) : (
        <path d={path} fill={color} />
      )}
    </svg>
  );
}

/* --- Composant principal --- */
export default function ProfileStarRing({
  anchorSize,
  avg3d = 0,
  starSize = 14,
  gapPx = -3,     // collé par défaut
  stepDeg = 10,   // resserré
  rotationDeg = 0,
  animateGlow = false,
}: Props) {
  const score = Math.max(0, Math.min(180, Math.round(avg3d)));

  // 1★ / 10 pts
  const fullUnder100 = Math.min(10, Math.floor(Math.min(score, 100) / 10));
  const hasHalf = score < 100 && score >= 15 && score % 10 === 5;

  // +1★ violette toutes les 20 au-dessus de 100
  const extraViolets = score > 100 ? Math.floor((Math.min(score, 180) - 100) / 20) : 0;

  const entries: StarEntry[] = [];

  // Pleines 1..fullUnder100
  for (let i = 1; i <= fullUnder100; i++) {
    entries.push({ color: STAR_COLORS[i - 1] || STAR_COLORS[STAR_COLORS.length - 1] });
  }

  // Demi (couleur du palier suivant)
  if (hasHalf) {
    const pos = fullUnder100 + 1;
    entries.push({ color: STAR_COLORS[pos - 1] || STAR_COLORS[STAR_COLORS.length - 1], half: true });
  }

  // Si score >100 : compléter les 10 premières pleines avant les extras
  if (score > 100 && fullUnder100 < 10) {
    for (let i = fullUnder100 + 1; i <= 10; i++) {
      entries.push({ color: STAR_COLORS[i - 1] });
    }
  }

  // Étoiles violettes supplémentaires
  for (let i = 0; i < extraViolets; i++) {
    entries.push({ color: STAR_COLORS[9] });
  }

  const count = entries.length;
  if (count === 0) return null;

  // Rayon centre→étoile
  const r = anchorSize / 2 + gapPx + starSize / 2;
  const halfSpread = (count - 1) * (stepDeg / 2);

  function pol2cart(angleDeg: number) {
    const a = ((angleDeg + rotationDeg) * Math.PI) / 180;
    return { x: Math.sin(a) * r, y: -Math.cos(a) * r };
  }

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {entries.map((e, i) => {
          const ang = -halfSpread + i * stepDeg; // centré à 12h
          const { x, y } = pol2cart(ang);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x - starSize / 2,
                top: y - starSize / 2,
              }}
            >
              <Star
                size={starSize}
                color={e.color}
                half={e.half}
                animate={animateGlow}
              />
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes psr-pulse-kf {
          0%   { transform: scale(1); opacity: 1; }
          50%  { transform: scale(1.08); opacity: .92; }
          100% { transform: scale(1); opacity: 1; }
        }
        .psr-pulse {
          animation: psr-pulse-kf 2.6s ease-in-out infinite;
          transform-origin: 50% 50%;
        }
      `}</style>
    </div>
  );
}
