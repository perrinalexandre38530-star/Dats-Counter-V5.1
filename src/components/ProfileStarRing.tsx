// ============================================
// src/components/ProfileStarRing.tsx
// Couronne d’étoiles autour du médaillon
// - Paliers couleur: 1-5 jaune, 6-7 orange, 8-9 rouge, 10+ violet
// - Demi-étoiles (15/25/.../95) avec la teinte de l’étoile suivante
// - Étoiles orientées tangentiellement à l’arc, centrées à 12h
// - gapPx < 0 pour coller au bord du médaillon
// ============================================
import React from "react";

type Props = {
  anchorSize: number;      // diamètre réel du médaillon (avatar + bord)
  starSize?: number;       // px
  gapPx?: number;          // décalage radial (px) — négatif = plus près
  avg3d?: number;          // moyenne 3-darts
  centerDeg?: number;      // centre du faisceau (deg) — -90 = 12h
  stepDeg?: number;        // écart angulaire entre étoiles
  rotationDeg?: number;    // offset global (deg)
  onlyLit?: boolean;       // n’afficher que les étoiles “allumées”
};

/* ---------- Palette stricte par paliers ---------- */
const COL_YELLOW = "#FFD84A"; // jaune doré
const COL_ORANGE = "#FF8A2E"; // orange
const COL_RED    = "#FF4A4A"; // rouge
const COL_VIOLET = "#D86CFF"; // violet clair

function colorForRank(rank1: number): string {
  if (rank1 >= 10) return COL_VIOLET;
  if (rank1 >= 8)  return COL_RED;
  if (rank1 >= 6)  return COL_ORANGE;
  return COL_YELLOW; // 1..5
}

/* ---------- Étoiles pleines / demi ---------- */
function StarSVG({
  size,
  fill,
  rotationDeg = 0,
}: { size: number; fill: string; rotationDeg?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: `rotate(${rotationDeg}deg)` }}
    >
      <path
        d="M50 5 L61 36 L94 38 L68 57 L77 88 L50 71 L23 88 L32 57 L6 38 L39 36 Z"
        fill={fill}
      />
    </svg>
  );
}

function HalfStar({
  size,
  color,
  rotationDeg = 0,
}: { size: number; color: string; rotationDeg?: number }) {
  const id = React.useId();
  const empty = "rgba(255,255,255,0.18)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ transform: `rotate(${rotationDeg}deg)` }}
    >
      <defs>
        <clipPath id={id}>
          {/* moitié gauche remplie */}
          <rect x="0" y="0" width="50" height="100" />
        </clipPath>
      </defs>
      <path
        d="M50 5 L61 36 L94 38 L68 57 L77 88 L50 71 L23 88 L32 57 L6 38 L39 36 Z"
        fill={empty}
      />
      <path
        d="M50 5 L61 36 L94 38 L68 57 L77 88 L50 71 L23 88 L32 57 L6 38 L39 36 Z"
        fill={color}
        clipPath={`url(#${id})`}
      />
    </svg>
  );
}

/* ---------- Couronne ---------- */
export default function ProfileStarRing({
  anchorSize,
  starSize = 14,
  gapPx = -2,
  avg3d = 0,
  centerDeg = -90,   // 12h
  stepDeg = 10,
  rotationDeg = 0,
  onlyLit = true,
}: Props) {
  const clamped = Math.max(0, Math.min(180, avg3d));
  const full = Math.floor(clamped / 10);     // 0..18
  const rest = Math.floor(clamped % 10);     // 0..9
  const hasHalf = rest >= 5 && full < 10;    // demi seulement < 100
  const litCount = onlyLit ? full + (hasHalf ? 1 : 0) : 10;

  // Rayon centre→étoile (tangence parfaite)
  const r = anchorSize / 2 + gapPx + starSize / 2;

  // Angles centrés à 12h
  const spread = litCount > 1 ? stepDeg * (litCount - 1) : 0;
  const start = centerDeg - spread / 2;

  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < litCount; i++) {
    const angle = start + i * stepDeg;
    const a = ((angle + rotationDeg) * Math.PI) / 180;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;

    // Orientation tangentielle (perpendiculaire au rayon)
    const tangentDeg = angle + 90;

    // Couleur: rang 1-based (½ étoile = couleur de l’étoile suivante)
    const rank1 = Math.min(i + 1, 10);
    const color = colorForRank(rank1);

    const isHalf = hasHalf && i === litCount - 1 && full < 10;

    nodes.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: `calc(50% + ${x}px)`,
          top: `calc(50% + ${y}px)`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {isHalf ? (
          <HalfStar size={starSize} color={color} rotationDeg={tangentDeg} />
        ) : (
          <StarSVG size={starSize} fill={color} rotationDeg={tangentDeg} />
        )}
      </div>
    );
  }

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {nodes}
    </div>
  );
}
