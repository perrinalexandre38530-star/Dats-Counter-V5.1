// ============================================ 
// src/pages/StatsHub.tsx — Stats + Historique (reprise intégrée + overlay de manche)
// - Onglet Stats étoffé (Flèches, Moyenne & Max Points, Points, Checkout)
// - Historique : LEG -> overlay, X01 FINISHED -> x01_end, IN_PROGRESS -> reprise
// ============================================

import { useEffect, useMemo, useState } from "react";
import { History } from "../lib/history";
import { getLeaderboard, getPlayerMedallionStats, clearAllStats } from "../lib/stats";
import EndOfLegOverlay from "../components/EndOfLegOverlay";

/* --- Types légers --- */
type PlayerLite = { id: string; name: string; avatarDataUrl?: string | null };
type SavedMatch = {
  id: string;
  kind: "x01" | "cricket" | "leg" | string;
  status: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  updatedAt: number;
  payload?: any;     // pour kind === "leg": LegResult
  [k: string]: any;
};

type StatsHubProps = {
  go?: (tab: string, params?: any) => void;
  profiles?: PlayerLite[];
  tab?: "stats" | "history";
};

export default function StatsHub(props: StatsHubProps) {
  const go = props.go ?? (() => {});
  const [tab, setTab] = useState<"stats" | "history">(props.tab ?? "stats");

  // ===== Historique (X01 + LEG) =====
  const records = useMemo<SavedMatch[]>(() => {
    try {
      const list = (History.list?.() ?? []) as SavedMatch[];
      return list.filter((r) => r && (r.kind === "x01" || r.kind === "leg"));
    } catch {
      return [];
    }
  }, []);
  const sorted = useMemo(
    () => [...records].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [records]
  );

  // ===== Mapping id -> nom/avatar =====
  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of props.profiles ?? []) if (p?.id) map[p.id] = p.name || p.id.slice(0, 8);
    for (const rec of records) for (const p of rec.players ?? []) if (p?.id && !map[p.id]) map[p.id] = p.name || p.id.slice(0, 8);
    return map;
  }, [props.profiles, records]);
  const avatarMap = useMemo(() => {
    const map: Record<string, string | null | undefined> = {};
    for (const p of props.profiles ?? []) if (p?.id) map[p.id] = p.avatarDataUrl ?? null;
    for (const rec of records) for (const p of rec.players ?? []) if (p?.id && map[p.id] == null) map[p.id] = p.avatarDataUrl ?? null;
    return map;
  }, [props.profiles, records]);

  const nameOf = (id: string) => nameMap[id] ?? (id ? id.slice(0, 8) : "—");

  // ===== Overlay FIN DE MANCHE (LEG) =====
  const [legOpen, setLegOpen] = useState(false);
  const [legResult, setLegResult] = useState<any | null>(null);
  const [playersById, setPlayersById] = useState<Record<string, PlayerLite>>({});

  function openLegOverlay(rec: SavedMatch) {
    const payload = rec.payload;
    if (!payload) return;
    setLegResult(payload);
    const map: Record<string, PlayerLite> = {};
    for (const p of rec.players ?? []) {
      map[p.id] = { id: p.id, name: nameOf(p.id), avatarDataUrl: avatarMap[p.id] ?? null };
    }
    setPlayersById(map);
    setLegOpen(true);
  }

  // ===== Navigation / reprise X01 / vue fin de partie =====
  function handleResumeX01(rec: SavedMatch) {
    if (rec.kind === "leg" && rec.payload) {
      openLegOverlay(rec);
      return;
    }
    if (rec.kind === "x01" && rec.status === "finished") {
      go("x01_end", { recordId: rec.id, record: rec, readOnly: true, source: "history" });
      return;
    }
    go("x01", { resumeId: rec.id });
  }

  /* =========================
     ONGLET — STATS ÉTENDUES
  ==========================*/
  // Base = leaderboard par Avg3 → liste des joueurs connus avec avg3
  const leaderboard = useMemo(() => getLeaderboard("avg3") ?? [], [tab]);

  // Construit un dictionnaire stats par joueur
  const statsById = useMemo(() => {
    const out: Record<string, any> = {};
    for (const row of leaderboard) {
      const id = row.playerId ?? row.id ?? row.player ?? row;
      try {
        out[id] = getPlayerMedallionStats(id) ?? {};
      } catch {
        out[id] = {};
      }
      // conserve avg3 du leaderboard si absent dans la fiche
      if (row?.avg3 != null && out[id].avg3 == null) out[id].avg3 = row.avg3;
    }
    return out;
  }, [leaderboard]);

  // Helpers robustes (tolérance aux noms de champs)
  const pick = (obj: any, ...keys: string[]) => {
    for (const k of keys) if (obj && obj[k] != null) return obj[k];
    return undefined;
  };
  const nz = (v: any, d = 0) => (Number.isFinite(+v) ? +v : d);
  const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

  // Tables prêtes
  const tablePlayers = leaderboard.map((r: any, i: number) => {
    const id = r.playerId ?? r.id ?? r.player ?? r;
    const m = statsById[id] ?? {};
    return {
      rank: i + 1,
      id,
      name: nameOf(id),
      darts: nz(pick(m, "dartsThrown", "darts", "totalDarts")),
      // %DB / %TP
      dblPct: (() => {
        const made = nz(pick(m, "doubleMade", "doublesHit", "dbHits"));
        const att = nz(pick(m, "doubleAttempts", "doublesTried", "dbAttempts"));
        const alt = nz(pick(m, "doublePct", "dbPct"));
        return alt > 0 ? alt : pct(made, att);
      })(),
      tplPct: (() => {
        const made = nz(pick(m, "tripleMade", "triplesHit", "tpHits"));
        const att = nz(pick(m, "tripleAttempts", "triplesTried", "tpAttempts"));
        const alt = nz(pick(m, "triplePct", "tpPct"));
        return alt > 0 ? alt : pct(made, att);
      })(),
      bullPct: nz(pick(m, "bullPct", "bullPercent")),
      dbullPct: nz(pick(m, "dbullPct", "doubleBullPct")),
      // Moyennes & max
      avg3: nz(pick(m, "avg3", "average3")),
      first9: nz(pick(m, "first9", "firstNineAvg", "first9Avg")),
      maxPts: nz(pick(m, "maxPoints", "bestVisit", "highestVisit")),
      // Bins
      s60: nz(pick(m, "ton60", "s60", "hits60")),
      s100: nz(pick(m, "ton100", "s100", "hits100")),
      s140: nz(pick(m, "ton140", "s140", "hits140")),
      s180: nz(pick(m, "ton180", "s180", "hits180")),
      // Checkout
      hiCO: nz(pick(m, "highestCheckout", "highCheckout", "maxCheckout")),
      minDarts: nz(pick(m, "minDarts", "bestLegDarts")),
      coPct: (() => {
        const made = nz(pick(m, "checkoutMade", "coMade", "coHits"));
        const att = nz(pick(m, "checkoutAttempts", "coAttempts"));
        const alt = nz(pick(m, "checkoutPct", "coPct"));
        return alt > 0 ? alt : pct(made, att);
      })(),
    };
  });

  const hasAnyStats = tablePlayers.length > 0;

  // ===== UI wrappers =====
  const wrap = (children: any) => (
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {children}
    </div>
  );

  return (
    <div className="container" style={{ padding: 12 }}>
      {/* Tabs */}
      <div
        style={{
          display: "inline-flex",
          gap: 8,
          padding: 6,
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 12,
          marginBottom: 12,
        }}
      >
        <button onClick={() => setTab("stats")} style={tabBtn(tab === "stats")}>Stats</button>
        <button onClick={() => setTab("history")} style={tabBtn(tab === "history")}>Historique</button>
      </div>

      {/* ====== Onglet Stats (étendu) ====== */}
      {tab === "stats" &&
        wrap(
          <>
            {!hasAnyStats ? (
              <div style={card}>
                <div style={title}>Stats</div>
                <div style={text}>
                  Termine une manche X01 pour alimenter ces tableaux. Les valeurs affichées récupèrent toutes les
                  données du tableau de fin de partie (classement) et des stats globales.
                </div>
              </div>
            ) : (
              <>
                {/* Flèches */}
                <div style={card}>
                  <SectionHeader>Flèches</SectionHeader>
                  <DataTable
                    headers={["#", "Joueurs", "Flèches", "Double %", "Triple %", "Bull %", "DBull %"]}
                    rows={tablePlayers.map((p) => [
                      p.rank,
                      p.name,
                      p.darts,
                      fmtPct(p.dblPct),
                      fmtPct(p.tplPct),
                      fmtPct(p.bullPct),
                      fmtPct(p.dbullPct),
                    ])}
                  />
                </div>

                {/* Moyenne & Max Points */}
                <div style={card}>
                  <SectionHeader>Moyenne et Max Points</SectionHeader>
                  <DataTable
                    headers={["#", "Joueurs", "Moyenne Ø", "Première-9 Ø", "Points Max"]}
                    rows={tablePlayers.map((p) => [
                      p.rank,
                      p.name,
                      p.avg3.toFixed(2),
                      p.first9 ? p.first9.toFixed(2) : "—",
                      p.maxPts || "—",
                    ])}
                  />
                </div>

                {/* Points (bins) */}
                <div style={card}>
                  <SectionHeader>Points</SectionHeader>
                  <DataTable
                    headers={["#", "Joueurs", "60+", "100+", "140+", "180"]}
                    rows={tablePlayers.map((p) => [p.rank, p.name, p.s60, p.s100, p.s140, p.s180])}
                  />
                </div>

                {/* Checkout */}
                <div style={card}>
                  <SectionHeader>Checkout</SectionHeader>
                  <DataTable
                    headers={["#", "Joueurs", "Max Checkout", "Min Darts", "Checkout %"]}
                    rows={tablePlayers.map((p) => [
                      p.rank,
                      p.name,
                      p.hiCO || 0,
                      p.minDarts || "—",
                      fmtPct(p.coPct),
                    ])}
                  />
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => {
                      if (confirm("Réinitialiser toutes les stats locales ?")) {
                        clearAllStats();
                        location.reload();
                      }
                    }}
                    style={dangerBtn}
                  >
                    Vider les stats
                  </button>
                </div>
              </>
            )}
          </>
        )}

      {/* ====== Onglet Historique ====== */}
      {tab === "history" &&
        wrap(
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <FilterPill label="Tous les jeux" active />
              <FilterPill label="X01" />
              <FilterPill label="CRICKET" />
              <FilterPill label="LEG" />
              <button
                onClick={() => {
                  if (confirm("Supprimer tout l’historique ?")) {
                    History.clear?.();
                    location.reload();
                  }
                }}
                style={dangerBtn}
              >
                Vider
              </button>
            </div>

            {sorted.map((rec) => {
              const status = rec.status === "finished" ? "FINISHED" : "IN PROGRESS";
              const tag = rec.kind?.toUpperCase?.() || "—";
              const dt = new Date(rec.updatedAt || Date.now()).toLocaleString();
              const canViewLeg = rec.kind === "leg" && !!rec.payload;

              return (
                <div
                  key={rec.id}
                  onClick={() => {
                    if (rec.status === "in_progress") handleResumeX01(rec);
                  }}
                  style={itemCard}
                >
                  {/* Ligne 1 : tag + date + statut */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 800, color: "#ffcf57" }}>
                      {tag}
                      <span style={{ opacity: 0.7, marginLeft: 8, color: "#ffffff" }}>{dt}</span>
                    </div>
                    <span style={statusPill(status)}>{status}</span>
                  </div>

                  {/* Ligne 2 : Médaillons joueurs */}
                  <PlayersMedallions players={rec.players ?? []} nameOf={nameOf} avatarMap={avatarMap} />

                  {/* Ligne 3 : Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (canViewLeg) {
                          openLegOverlay(rec);
                        } else if (rec.kind === "x01" && rec.status === "finished") {
                          go("x01_end", { recordId: rec.id, record: rec, readOnly: true, source: "history" });
                        } else {
                          handleResumeX01(rec);
                        }
                      }}
                      style={btn}
                    >
                      {canViewLeg ? "Voir stats (manche)" : "Voir stats"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Supprimer cette entrée ?")) {
                          (History.remove?.(rec.id) ?? History.delete?.(rec.id));
                          location.reload();
                        }
                      }}
                      style={dangerBtn}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

      {/* ===== Overlay FIN DE MANCHE ===== */}
      <EndOfLegOverlay
        open={legOpen}
        result={legResult}
        playersById={playersById}
        onClose={() => setLegOpen(false)}
        onReplay={() => setLegOpen(false)}
        onSave={() => setLegOpen(false)}
      />
    </div>
  );
}

/* ===== UI utils ===== */
const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.12)",
  background: active ? "linear-gradient(180deg,#ffc63a,#ffaf00)" : "transparent",
  color: active ? "#151519" : "#e8e8ec",
  fontWeight: 800,
  cursor: "pointer",
});

const card: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.08)",
  background: "linear-gradient(180deg,#18181c,#101115)",
};

const title: React.CSSProperties = { fontWeight: 900, color: "#ffcf57", marginBottom: 6 };
const text: React.CSSProperties = { color: "#d9dbe3" };

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 13,
};
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 8px",
  borderBottom: "1px solid rgba(255,255,255,.1)",
  fontWeight: 900,
  color: "#ffcf57",
};
const thRight = { ...th, textAlign: "right" as const };
const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid rgba(255,255,255,.06)" };
const tdRight = { ...td, textAlign: "right" as const };

const mini: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.08)",
  background: "linear-gradient(180deg,#191a1f,#111218)",
};
const btn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.08)",
  color: "#eee",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};
const dangerBtn: React.CSSProperties = {
  ...btn,
  background: "transparent",
  border: "1px solid rgba(255,80,80,.35)",
  color: "#ff9a9a",
};

function FilterPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,.12)",
        background: active ? "rgba(255,198,58,.1)" : "transparent",
        color: active ? "#ffcf57" : "#dfe2ea",
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}

const itemCard: React.CSSProperties = {
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.08)",
  background: "linear-gradient(180deg,#17181d,#101116)",
};

const statusPill = (s: "FINISHED" | "IN PROGRESS"): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 999,
  fontWeight: 900,
  color: s === "FINISHED" ? "#7fe2a9" : "#ffd060",
  border: `1px solid ${s === "FINISHED" ? "rgba(24,160,96,.35)" : "rgba(255,187,51,.35)"}`,
});

/* ===== Médaillons joueurs (avatars + noms) ===== */
function PlayersMedallions({
  players,
  nameOf,
  avatarMap,
}: {
  players: PlayerLite[];
  nameOf: (id: string) => string;
  avatarMap: Record<string, string | null | undefined>;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
      {players.map((p) => {
        const avatar = avatarMap[p.id] ?? p.avatarDataUrl ?? null;
        const initials = (p.name || nameOf(p.id)).slice(0, 2).toUpperCase();
        return (
          <div key={p.id} title={nameOf(p.id)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,.15)",
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,.06)",
                userSelect: "none",
              }}
            >
              {avatar ? (
                <img src={avatar} alt={nameOf(p.id)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 12, color: "#fff" }}>{initials}</span>
              )}
            </div>
            <span style={{ fontSize: 12, color: "#fff", opacity: 0.9 }}>{nameOf(p.id)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ====== Présentation tables ====== */
function SectionHeader({ children }: { children: any }) {
  return (
    <div style={{ fontWeight: 900, color: "#ffcf57", fontSize: 16, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function DataTable({
  headers,
  rows,
}: {
  headers: (string | { label: string; align?: "left" | "right" })[];
  rows: (string | number)[][];
}) {
  return (
    <div style={{ overflow: "hidden", borderRadius: 10 }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {headers.map((h, i) => {
              const label = typeof h === "string" ? h : h.label;
              const align = typeof h === "string" ? "left" : h.align ?? "left";
              return (
                <th key={i} style={align === "right" ? thRight : th}>
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={j >= 2 ? tdRight : td}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ====== Helpers de format ====== */
function fmtPct(v: number) {
  return Number.isFinite(v) ? `${v.toFixed(2)}%` : "—";
}
