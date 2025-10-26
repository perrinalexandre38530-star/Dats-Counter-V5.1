// ============================================
// src/components/PlayersList.tsx
// Liste joueurs : avatar rond, nom doré, dernière volée en badges
// Stats par joueur (Set / Leg / Darts / Moy.3D)
// ============================================
import React from "react";

export type LastThrowView = {
  darts: Array<{ v: number; mult: 1 | 2 | 3 }>;
  bust?: boolean;
};

export type PlayerRow = {
  id: string;
  name: string;
  score: number;

  // avatars tolérants
  avatarDataUrl?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;

  // nouvelle info
  last?: LastThrowView;
  dartsCount?: number;    // total fléchettes
  avg3d?: number;         // moyenne /3 darts
  legs?: number;          // legs gagnés
  sets?: number;          // sets gagnés
};

function fmt(d?: { v: number; mult: 1 | 2 | 3 }) {
  if (!d) return "—";
  if (d.v === 0) return "MISS";
  if (d.v === 25) return d.mult === 2 ? "DBULL" : "BULL";
  return `${d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"}${d.v}`;
}

export default function PlayersList({
  players,
  currentId,
}: {
  players: PlayerRow[];
  currentId?: string;
}) {
  const card: React.CSSProperties = {
    background:
      "linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.85))",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 18,
    padding: 12,
    boxShadow: "0 10px 30px rgba(0,0,0,.35)",
  };

  const rowBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 10,
    background:
      "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 14,
  };

  const badge = (label: string, style: React.CSSProperties = {}) => (
    <span
      key={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 24,
        padding: "0 10px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,.08)",
        background: "rgba(255,255,255,.06)",
        fontSize: 12,
        fontWeight: 800,
        color: "#eaeaf0",
        ...style,
      }}
    >
      {label}
    </span>
  );

  return (
    <div style={card}>
      {/* Titre / ancre repliable gérée en parent */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          color: "#e8e8ec",
          fontWeight: 800,
        }}
      >
        <span style={{ fontSize: 18 }}>Joueurs</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {players.map((p) => {
          const src =
            p.avatarDataUrl ?? p.avatar ?? p.avatarUrl ?? null;
          const isCurrent = currentId && p.id === currentId;

          // badges “dernière volée” (mêmes couleurs que le header)
          const last = p.last?.darts || [];
          const wasBust = Boolean(p.last?.bust);

          const chipStyles = (d?: { v: number; mult: 1 | 2 | 3 }): React.CSSProperties =>
            d?.v === 0
              ? { background: "rgba(255,255,255,.06)", color: "#bbb" }
              : d?.v === 25 && d?.mult === 2
              ? {
                  background: "rgba(13,160,98,.18)",
                  color: "#8ee6bf",
                  borderColor: "rgba(13,160,98,.35)",
                }
              : d?.v === 25
              ? {
                  background: "rgba(13,160,98,.12)",
                  color: "#7bd6b0",
                  borderColor: "rgba(13,160,98,.3)",
                }
              : d?.mult === 3
              ? {
                  background: "rgba(179,68,151,.18)",
                  color: "#ffd0ff",
                  borderColor: "rgba(179,68,151,.35)",
                }
              : d?.mult === 2
              ? {
                  background: "rgba(46,150,193,.18)",
                  color: "#cfeaff",
                  borderColor: "rgba(46,150,193,.35)",
                }
              : {
                  background: "rgba(255,187,51,.12)",
                  color: "#ffc63a",
                  borderColor: "rgba(255,187,51,.4)",
                };

          return (
            <div
              key={p.id}
              style={{
                ...rowBase,
                outline: isCurrent
                  ? "2px solid rgba(255,195,26,.45)"
                  : undefined,
                boxShadow: isCurrent
                  ? "0 0 18px rgba(255,195,26,.18)"
                  : rowBase.boxShadow as string,
              }}
            >
              {/* Avatar MEDAILLON */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background:
                    "linear-gradient(180deg, #1b1b1f, #111114)",
                  border: "1px solid rgba(255,255,255,.08)",
                  boxShadow: "0 6px 18px rgba(0,0,0,.35)",
                  flex: "0 0 auto",
                }}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#999",
                      fontWeight: 700,
                    }}
                  >
                    ?
                  </div>
                )}
              </div>

              {/* Nom + dernière volée sur la même ligne */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <div
                    title={p.name}
                    style={{
                      color: "#ffcf57", // NOM DORÉ
                      fontWeight: 900,
                      letterSpacing: 0.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </div>

                  {/* Dernière volée = badges */}
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      alignItems: "center",
                      minHeight: 24,
                    }}
                  >
                    {last.length === 0 && badge("—")}
                    {last.map((d, i) => badge(fmt(d), chipStyles(d)))}
                    {wasBust &&
                      badge("BUST", {
                        background: "rgba(215,58,73,.18)",
                        color: "#ff9aa1",
                        border: "1px solid rgba(215,58,73,.35)",
                      })}
                  </div>
                </div>

                {/* stats mini-ligne */}
                <div
                  style={{
                    color: "#b9bbc1",
                    fontSize: 12,
                    marginTop: 2,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span>Set : {p.sets ?? 0}</span>
                  <span>Leg : {p.legs ?? 0}</span>
                  <span>Darts : {p.dartsCount ?? 0}</span>
                  <span>Moy/3D : {(p.avg3d ?? 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Score à droite */}
              <div
                style={{
                  color: "#ffcf57",
                  fontWeight: 900,
                  fontSize: 22,
                  minWidth: 56,
                  textAlign: "right",
                }}
              >
                {p.score}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
