// ============================================
// src/components/MiniStatsGold.tsx
// Ruban "Mini-Stats" style doré (Moy/3 | Best | CO | Win%)
// - Garde le pipeline de données : statsBridge
// - Si 'seed' est fourni, l'utilise; sinon charge via getBasicProfileStats(profileId)
// ============================================
import React from "react";
import { getBasicProfileStats, type BasicProfileStats } from "../lib/statsBridge";

type Props = {
  profileId: string;
  /** Stats déjà connues (facultatif). Si non fourni, on fetch. */
  seed?: BasicProfileStats | undefined;
  /** Hauteur compacte optionnelle */
  compact?: boolean;
};

export default function MiniStatsGold({ profileId, seed, compact = true }: Props) {
  const [stats, setStats] = React.useState<BasicProfileStats | undefined>(seed);

  React.useEffect(() => {
    let stop = false;
    if (!seed && profileId) {
      (async () => {
        try {
          const s = await getBasicProfileStats(profileId);
          if (!stop) setStats(s);
        } catch {/* no-op */}
      })();
    }
    return () => { stop = true; };
  }, [profileId, seed]);

  const avg3 = fmt(stats?.avg3 ?? 0);
  const best = stats?.bestVisit ?? 0;
  // "CO" = checkouts réussis; selon ton statsBridge, adapte le champ si dispo (fallback 0)
  const co = (stats as any)?.checkouts ?? 0;
  const winPct = winPctFromBasics(stats);

  return (
    <div
      aria-label="Mini-Stats"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: compact ? "6px 10px" : "8px 12px",
        borderRadius: 6,
        background: "linear-gradient(180deg, rgba(63,43,14,.65), rgba(26,16,6,.65))",
        border: "1px solid rgba(240,177,42,.18)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.06), 0 4px 14px rgba(240,177,42,.10)",
        color: "#f5d089",
        width: "fit-content",
        whiteSpace: "nowrap",
      }}
    >
      <Cell label="Moy/3" value={avg3} />
      <Cell label="Best" value={best} />
      <Cell label="CO" value={co} />
      <Cell label="Win%" value={winPct} alignEnd />
    </div>
  );
}

/* ---- sous-éléments ---- */
function Cell({ label, value, alignEnd = false }: { label: string; value: React.ReactNode; alignEnd?: boolean }) {
  return (
    <div style={{ display: "grid", gridAutoFlow: "row", lineHeight: 1.1, minWidth: alignEnd ? 38 : 0 }}>
      <span style={{ fontSize: 11, color: "rgba(255,235,190,.9)" }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: 14, color: "#F0B12A" }}>{value}</span>
    </div>
  );
}

/* ---- utils locales ---- */
function fmt(n: number) {
  return (Math.round((n ?? 0) * 10) / 10).toFixed(1);
}
function winPctFromBasics(s?: BasicProfileStats) {
  if (!s) return "—";
  const pct = s.legsPlayed > 0 ? Math.round((s.legsWon / s.legsPlayed) * 100) : 0;
  return `${pct}%`;
}
