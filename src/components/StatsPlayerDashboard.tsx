// ============================================
// src/components/StatsPlayerDashboard.tsx
// Dashboard joueur — Verre dépoli OR (responsive sans dépassement)
// ============================================
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Types ---------- */
export type VisitBucket = "0-59" | "60-99" | "100+" | "140+" | "180";
export type PlayerGamePoint = { date: string; avg3: number };
export type PlayerDistribution = Record<VisitBucket, number>;
export type PlayerDashboardStats = {
  playerId: string;
  playerName: string;
  avg3Overall: number;
  bestVisit: number;
  winRatePct: number;
  bestCheckout?: number;
  evolution: PlayerGamePoint[];
  distribution: PlayerDistribution;
};

/* ---------- Thème ---------- */
const T = {
  gold: "#F6C256",
  goldEdge: "rgba(246,194,86,.55)",
  goldEdgeStrong: "rgba(246,194,86,.9)",
  text: "#FFFFFF",
  text70: "rgba(255,255,255,.70)",
  text75: "rgba(255,255,255,.75)",
  text60: "rgba(255,255,255,.60)",
  edge: "rgba(255,255,255,.10)",
  card: "linear-gradient(180deg,rgba(17,18,20,.94),rgba(13,14,17,.92))",
  tile: "linear-gradient(180deg,rgba(21,22,26,.96),rgba(17,18,22,.94))",
  chip: "linear-gradient(180deg,rgba(27,29,34,.95),rgba(22,24,29,.95))",
  axis: "rgba(42,43,47,1)",
  grid: "rgba(36,37,40,1)",
};

/* ---------- Base styles ---------- */
const glassCard: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.edge}`,
  borderRadius: 20,
  boxShadow: "0 10px 26px rgba(0,0,0,.35)",
  backdropFilter: "blur(10px)",
};
const tile: React.CSSProperties = {
  background: T.tile,
  border: `1px solid ${T.edge}`,
  borderRadius: 20,
  padding: 16,
  boxShadow: "inset 0 0 0 1px rgba(255,255,255,.02)",
};
const iconBadge: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 12,
  display: "grid",
  placeItems: "center",
  background: T.chip,
  border: `1px solid ${T.edge}`,
  color: T.gold,
};

/* ---------- Icônes ---------- */
const IconBars = ({ size = 18, color = T.text }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="11" width="4" height="8" rx="1.5" stroke={color} strokeWidth="1.8" />
    <rect x="10" y="7" width="4" height="12" rx="1.5" stroke={color} strokeWidth="1.8" />
    <rect x="17" y="4" width="4" height="15" rx="1.5" stroke={color} strokeWidth="1.8" />
  </svg>
);
const IconTarget = ({ size = 18, color = T.text }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" />
  </svg>
);
const IconPercent = ({ size = 18, color = T.text }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M6 18L18 6" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="7" cy="7" r="2.4" stroke={color} strokeWidth="1.8" />
    <circle cx="17" cy="17" r="2.4" stroke={color} strokeWidth="1.8" />
  </svg>
);
const IconHourglass = ({ size = 18, color = T.text }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M7 4h10M7 20h10M8 4c0 5 8 5 8 8s-8 3-8 8" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/* ---------- UI réutilisable ---------- */
export function GoldPill({
  children,
  active = false,
  onClick,
  leftIcon,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  leftIcon?: React.ReactNode;
}) {
  const base: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 16,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: `1px solid ${active ? T.goldEdgeStrong : T.edge}`,
    background: active ? "rgba(246,194,86,.10)" : "rgba(255,255,255,.02)",
    color: T.text,
    boxShadow: active ? "inset 0 0 0 1px rgba(246,194,86,.25)" : "none",
  };
  return (
    <button style={base} onClick={onClick}>
      {leftIcon ? <span style={{ display: "grid", placeItems: "center" }}>{leftIcon}</span> : null}
      <span style={{ fontWeight: 600 }}>{children}</span>
    </button>
  );
}

export function ProfilePill({
  name,
  avatarDataUrl,
  active = false,
  onClick,
}: {
  name: string;
  avatarDataUrl?: string | null;
  active?: boolean;
  onClick?: () => void;
}) {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? T.goldEdgeStrong : T.edge}`,
    background: active ? "rgba(246,194,86,.10)" : "rgba(255,255,255,.02)",
    color: T.text,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
  return (
    <button style={base} onClick={onClick}>
      {avatarDataUrl ? (
        <img src={avatarDataUrl} alt={name} width={22} height={22} style={{ borderRadius: 999, objectFit: "cover" }} />
      ) : (
        <div style={{ width: 22, height: 22, borderRadius: 999, background: "rgba(255,255,255,.10)" }} />
      )}
      <span style={{ fontWeight: 700, fontSize: 13 }}>{name}</span>
    </button>
  );
}

/* ---------- Titres ---------- */
const H1 = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.2, color: T.text }}>{children}</div>
);
const Sub = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 13, color: T.text70 }}>{children}</div>;

/* ---------- Hook largeur conteneur ---------- */
function useContainerWidth<T extends HTMLElement>(min = 300): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(min);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(min, Math.floor(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(min, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, [min]);
  return [ref, w];
}

/* ---------- Helpers charts ---------- */
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const rng = (n: number) => [...Array(n).keys()];
const niceMax = (v: number) =>
  v <= 10 ? 10 : v <= 20 ? 20 : v <= 40 ? 40 : v <= 60 ? 60 : v <= 80 ? 80 : v <= 100 ? 100 : Math.ceil(v / 50) * 50;

/* ---------- Tiles ---------- */
function Tile({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div style={tile}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: T.text75 }}>{label}</span>
        <span style={iconBadge}>{icon ?? <IconBars color={T.gold} />}</span>
      </div>
      <div style={{ fontSize: 28, lineHeight: "28px", fontWeight: 600, color: T.text }}>{value}</div>
      {sub && <div style={{ marginTop: 4, fontSize: 12, color: T.text60 }}>{sub}</div>}
    </div>
  );
}

/* ---------- Line chart (responsive, no overflow) ---------- */
function LineChart({
  points,
  height = 240,
  padding = 36,
  width,
}: {
  points: PlayerGamePoint[];
  height?: number;
  padding?: number;
  width: number; // largeur mesurée du conteneur
}) {
  // enlever le padding interne horizontal (on le gère via "padding" du graph)
  const svgW = Math.max(220, width - 32); // ← évite +32px des paddings éventuels
  const pts =
    points.length >= 2
      ? points
      : [{ date: points[0]?.date ?? "—", avg3: points[0]?.avg3 ?? 50 }, { date: "", avg3: points[0]?.avg3 ?? 50 }];

  const { path, area, xTicks, yTicks } = useMemo(() => {
    const max = niceMax(Math.max(...pts.map((p) => p.avg3), 10));
    const plotW = svgW - padding * 2;
    const plotH = height - padding * 2;
    const x = (i: number) => (pts.length === 1 ? padding + plotW / 2 : padding + (i / (pts.length - 1)) * plotW);
    const y = (v: number) => padding + plotH - (v / max) * plotH;

    const d = pts.map((p, i) => `${i ? "L" : "M"} ${x(i)} ${y(p.avg3)}`).join(" ");
    const a = `${d} L ${x(pts.length - 1)} ${height - padding} L ${x(0)} ${height - padding} Z`;

    const xTicks = pts.map((p, i) => ({ x: x(i), label: p.date || "" }));
    const yTicks = rng(5).map((k) => {
      const val = (k / 4) * max;
      return { y: y(val), label: Math.round(val).toString() };
    });

    return { path: d, area: a, xTicks, yTicks };
  }, [pts, height, padding, svgW]);

  return (
    <section style={{ ...glassCard, width: "100%", overflow: "hidden" }}>
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={iconBadge}>
          <IconBars color={T.gold} />
        </div>
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>Évolution</div>
          <div style={{ fontSize: 12, color: T.text60 }}>Moyenne par partie</div>
        </div>
      </div>

      {/* pas de padding horizontal ici */}
      <div style={{ padding: "0 0 12px" }}>
        <svg
          width={svgW}
          height={height}
          style={{ display: "block", width: "100%", maxWidth: "100%" }}
          viewBox={`0 0 ${svgW} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={T.gold} stopOpacity="0.28" />
              <stop offset="100%" stopColor={T.gold} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <line x1={padding} y1={height - padding} x2={svgW - padding} y2={height - padding} stroke={T.axis} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke={T.axis} />

          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padding} y1={t.y} x2={svgW - padding} y2={t.y} stroke={T.grid} />
              <text x={padding - 10} y={t.y + 4} textAnchor="end" style={{ fontSize: 10, fill: "rgba(255,255,255,.65)" }}>
                {t.label}
              </text>
            </g>
          ))}

          <path d={area} fill="url(#goldArea)" />
          <path d={path} fill="none" stroke={T.gold} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {xTicks.map((t, i) =>
            i % Math.max(1, Math.ceil(xTicks.length / 6)) === 0 ? (
              <text key={i} x={t.x} y={height - (padding - 12)} textAnchor="middle" style={{ fontSize: 10, fill: "rgba(255,255,255,.65)" }}>
                {t.label}
              </text>
            ) : null
          )}
        </svg>
      </div>
    </section>
  );
}

/* ---------- Bar chart (responsive, no overflow) ---------- */
function BarChart({
  data,
  height = 240,
  padding = 36,
  width,
}: {
  data: PlayerDistribution;
  height?: number;
  padding?: number;
  width: number;
}) {
  const svgW = Math.max(220, width - 32); // ← même correction
  const buckets: VisitBucket[] = ["0-59", "60-99", "100+", "140+", "180"];
  const vals = buckets.map((b) => data[b] ?? 0);
  const max = niceMax(Math.max(1, ...vals));
  const plotW = svgW - padding * 2;
  const plotH = height - padding * 2;
  const gap = 16;
  const barW = (plotW - gap * (buckets.length - 1)) / buckets.length;

  return (
    <section style={{ ...glassCard, width: "100%", overflow: "hidden" }}>
      <div style={{ padding: "16px 16px 8px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={iconBadge}>
          <IconBars color={T.gold} />
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)" }}>Répartition des volées</div>
      </div>

      <div style={{ padding: "0 0 12px" }}>
        <svg
          width={svgW}
          height={height}
          style={{ display: "block", width: "100%", maxWidth: "100%" }}
          viewBox={`0 0 ${svgW} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <line x1={padding} y1={height - padding} x2={svgW - padding} y2={height - padding} stroke={T.axis} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke={T.axis} />

          {rng(5).map((i) => {
            const y = padding + (i / 4) * plotH;
            const label = Math.round(((4 - i) / 4) * max);
            return (
              <g key={i}>
                <line x1={padding} y1={y} x2={svgW - padding} y2={y} stroke={T.grid} />
                <text x={padding - 10} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: "rgba(255,255,255,.65)" }}>
                  {label}
                </text>
              </g>
            );
          })}

          {buckets.map((b, i) => {
            const v = vals[i];
            const h = (v / max) * plotH;
            const x = padding + i * (barW + gap);
            const y = padding + (plotH - h);
            return (
              <g key={b}>
                <rect x={x} y={y} width={barW} height={h} rx={12} fill={T.gold} />
                <rect x={x} y={y} width={barW} height={h} rx={12} fill="transparent" stroke="rgba(122,90,22,.35)" />
                <text x={x + barW / 2} y={height - (padding - 14)} textAnchor="middle" style={{ fontSize: 11, fill: "rgba(255,255,255,.85)" }}>
                  {b}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

/* ---------- Composant principal ---------- */
export default function StatsPlayerDashboard({ data }: { data: PlayerDashboardStats }) {
  const [refL, wL] = useContainerWidth<HTMLDivElement>(320);
  const [refB, wB] = useContainerWidth<HTMLDivElement>(320);

  return (
    <section style={{ color: T.text }}>
      {/* Header lié au joueur */}
      <div style={{ ...glassCard, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={iconBadge}>
            <IconBars color={T.gold} />
          </div>
          <div>
            <H1>Statistiques — {data.playerName}</H1>
            <Sub>Analyse des performances par joueur — X01, Cricket & entraînements</Sub>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(1, minmax(0,1fr))" }} className="sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Moyenne / 3 flèches" value={`${data.avg3Overall.toFixed(1)} pts`} sub="Visites moyennes" icon={<IconBars color={T.gold} />} />
          <Tile label="Meilleure volée" value={`${data.bestVisit} pts`} sub="Record personnel" icon={<IconTarget color={T.gold} />} />
          <Tile label="Taux de victoire" value={`${clamp(data.winRatePct, 0, 100).toFixed(0)} %`} sub="Toutes manches" icon={<IconPercent color={T.gold} />} />
          <Tile label="Plus haut checkout" value={data.bestCheckout != null ? `${data.bestCheckout}` : "—"} sub="X01" icon={<IconHourglass color={T.gold} />} />
        </div>
      </div>

      {/* Graphs responsives (aucun dépassement) */}
      <div style={{ display: "grid", gap: 12, marginTop: 16 }} className="lg:grid-cols-2">
        <div ref={refL} style={{ width: "100%" }}>
          <LineChart points={data.evolution} width={wL} />
        </div>
        <div ref={refB} style={{ width: "100%" }}>
          <BarChart data={data.distribution} width={wB} />
        </div>
      </div>
    </section>
  );
}
