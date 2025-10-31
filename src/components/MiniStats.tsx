// ============================================
// src/components/MiniStats.tsx
// Mini bloc de stats par profil (compact)
// ============================================

import React from "react";
import { getBasicProfileStats, type BasicProfileStats } from "../lib/statsBridge";

export function MiniStats({
  profileId,
  title = "Mini-Stats",
  className,
}: {
  profileId: string;
  title?: string;
  className?: string;
}) {
  const [stats, setStats] = React.useState<BasicProfileStats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let stop = false;
    if (!profileId) return;

    (async () => {
      try {
        const s = await getBasicProfileStats(profileId);
        if (!stop) setStats(s);
      } catch (e: any) {
        if (!stop) setErr(e?.message || "Erreur de stats");
      }
    })();

    return () => {
      stop = true;
    };
  }, [profileId]);

  const box: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 10,
    background: "linear-gradient(180deg, rgba(18,18,22,.85), rgba(10,10,12,.85))",
    padding: 8,
  };
  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.04)",
    fontWeight: 800,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
  const label: React.CSSProperties = { opacity: 0.8, fontWeight: 700 };

  if (err) {
    return (
      <div className={className} style={box}>
        <div className="subtitle">{title}</div>
        <div style={{ color: "#ff8080", fontSize: 12 }}>{err}</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className={className} style={box}>
        <div className="subtitle">{title}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <span style={{ ...chip, width: 90, opacity: 0.5 }}>Chargement…</span>
        </div>
      </div>
    );
  }

  const winPct =
    stats.legsPlayed > 0 ? Math.round((stats.legsWon / stats.legsPlayed) * 100) : 0;

  return (
    <div className={className} style={box}>
      <div className="subtitle">{title}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <span style={chip}>
          <span style={label}>Moy/3</span> {fmt(stats.avg3)}
        </span>
        <span style={chip}>
          <span style={label}>Best</span> {stats.bestVisit}
        </span>
        <span style={chip}>
          <span style={label}>Win</span> {winPct}%
        </span>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return (Math.round((n ?? 0) * 10) / 10).toFixed(1);
}

export default MiniStats;
