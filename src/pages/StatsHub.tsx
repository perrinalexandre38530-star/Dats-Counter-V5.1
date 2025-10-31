// ============================================
// src/pages/StatsHub.tsx — Stats + Historique
// (reprise intégrée + overlay de manche)
// - Onglet Stats étoffé (Flèches, Moyenne & Max Points, Points, Checkout)
// - Historique : LEG -> overlay, X01 FINISHED -> x01_end, IN_PROGRESS -> reprise
// - Calculs de stats unifiés à partir de l'Historique (aggregateMatch)
// ============================================

import { useEffect, useMemo, useState } from "react";
import { History } from "../lib/history";
import EndOfLegOverlay from "../components/EndOfLegOverlay";
import {
  aggregateMatch,
  type LegStats,
  type MatchStats,
  type PlayerId,
} from "../lib/stats";

/* --- Types légers --- */
type PlayerLite = { id: string; name: string; avatarDataUrl?: string | null };
type SavedMatch = {
  id: string;
  kind: "x01" | "cricket" | "leg" | string;
  status: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  updatedAt: number;
  legs?: any[];      // pour kind === "x01" (array de LegStats possiblement)
  payload?: any;     // pour kind === "leg": LegResult (ancien schéma)
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
  const [records, setRecords] = useState<SavedMatch[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const all = await (History.getAll?.() ?? History.list?.() ?? []);
        // Normalise : injecte un id si absent pour compat
        const list: SavedMatch[] = (all as any[]).map((r: any) => ({
          ...r,
          id: r.id ?? r.matchId ?? crypto.randomUUID(),
        }));
        setRecords(list.filter((r) => r && (r.kind === "x01" || r.kind === "leg")));
      } catch {
        setRecords([]);
      }
    })();
  }, []);

  const sorted = useMemo(
    () => [...records].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [records]
  );

  // ===== Mapping id -> nom/avatar =====
  const nameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of props.profiles ?? []) if (p?.id) map[p.id] = p.name || p.id.slice(0, 8);
    for (const rec of records) {
      for (const p of rec.players ?? []) {
        if (p?.id && !map[p.id]) map[p.id] = p.name || p.id.slice(0, 8);
      }
    }
    return map;
  }, [props.profiles, records]);

  const avatarMap = useMemo(() => {
    const map: Record<string, string | null | undefined> = {};
    for (const p of props.profiles ?? []) if (p?.id) map[p.id] = p.avatarDataUrl ?? null;
    for (const rec of records) {
      for (const p of rec.players ?? []) {
        if (p?.id && map[p.id] == null) map[p.id] = p.avatarDataUrl ?? null;
      }
    }
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
     (globales par joueur sur TOUT l'historique X01)
  ==========================*/

  // 1) Collecte toutes les stats de match (aggregateMatch) et fusionne par joueur
  type GlobalAgg = {
    playerId: PlayerId;
    matches: number;
    legsPlayed: number;
    legsWon: number;

    darts: number;
    visits: number;
    totalScored: number;

    bestVisit: number;
    bins: { "60+": number; "100+": number; "140+": number; "180": number };

    // tentatives / hits pour % dérivés
    dblAtt: number; dblHit: number;
    triAtt: number; triHit: number;
    bullAtt: number; bullHit: number;
    dbullAtt: number; dbullHit: number;

    // checkout
    coAtt: number; coHit: number; coHi: number; coDartsSum: number;

    // first9: moyenne des moyennes de leg (pondérée "par leg")
    first9Sum: number; first9Legs: number;

    // min darts (best leg)
    minDarts?: number;
  };

  const globals = useMemo(() => {
    const map: Record<string, GlobalAgg> = {};

    const x01Matches = records.filter((r) => r.kind === "x01" && Array.isArray(r.legs) && (r.players?.length ?? 0) > 0);

    for (const rec of x01Matches) {
      const legs: LegStats[] = (rec.legs as any[])
        .map((l) => {
          // enlève éventuel matchId dans les legs sauvegardés
          const { matchId: _m, ...rest } = l ?? {};
          return rest as LegStats;
        })
        .filter(Boolean);

      const players: PlayerId[] =
        rec.players?.map((p) => p.id) ??
        Array.from(new Set(legs.flatMap((l) => l.players)));

      if (!players.length || !legs.length) continue;

      const match = aggregateMatch(legs, players);

      for (const pid of players) {
        const s = match.aggregates[pid];
        if (!s) continue;

        if (!map[pid]) {
          map[pid] = {
            playerId: pid,
            matches: 0,
            legsPlayed: 0,
            legsWon: 0,
            darts: 0,
            visits: 0,
            totalScored: 0,
            bestVisit: 0,
            bins: { "60+": 0, "100+": 0, "140+": 0, "180": 0 },
            dblAtt: 0, dblHit: 0,
            triAtt: 0, triHit: 0,
            bullAtt: 0, bullHit: 0,
            dbullAtt: 0, dbullHit: 0,
            coAtt: 0, coHit: 0, coHi: 0, coDartsSum: 0,
            first9Sum: 0, first9Legs: 0,
            minDarts: undefined,
          };
        }

        const g = map[pid];
        g.matches += 1;
        g.legsPlayed += s.legsPlayed;
        g.legsWon += s.legsWon;

        g.darts += s.darts;
        g.visits += s.visits;
        g.totalScored += s.totalScored;

        g.bestVisit = Math.max(g.bestVisit, s.bestVisit);
        g.bins["60+"] += s.bins["60+"]; g.bins["100+"] += s.bins["100+"]; g.bins["140+"] += s.bins["140+"]; g.bins["180"] += s.bins["180"];

        g.dblAtt += s.rates.dblAttempts; g.dblHit += s.rates.dblHits;
        g.triAtt += s.rates.triAttempts; g.triHit += s.rates.triHits;
        g.bullAtt += s.rates.bullAttempts; g.bullHit += s.rates.bullHits;
        g.dbullAtt += s.rates.dbullAttempts; g.dbullHit += s.rates.dbullHits;

        g.coAtt += s.co.coAttempts; g.coHit += s.co.coHits;
        g.coHi = Math.max(g.coHi, s.co.highestCO);
        g.coDartsSum += s.co.totalCODarts;

        g.first9Sum += s.first9Avg; // moyenne par leg (on somme les moyennes)
        g.first9Legs += 1;

        if (typeof s.minDartsToFinish === "number") {
          g.minDarts = typeof g.minDarts === "number" ? Math.min(g.minDarts, s.minDartsToFinish) : s.minDartsToFinish;
        }
      }
    }

    // Transforme en tableau ordonné par avg3 DESC
    const rows = Object.values(map).map((g) => {
      const avg3 = g.visits > 0 ? g.totalScored / g.visits : 0;
      const first9 = g.first9Legs > 0 ? g.first9Sum / g.first9Legs : 0;
      const pct = (h: number, a: number) => (a > 0 ? (h / a) * 100 : 0);
      const coPct = pct(g.coHit, g.coAtt);

      return {
        id: g.playerId,
        name: nameOf(g.playerId),

        // Flèches
        darts: g.darts,
        dblPct: pct(g.dblHit, g.dblAtt),
        tplPct: pct(g.triHit, g.triAtt),
        bullPct: pct(g.bullHit, g.bullAtt),
        dbullPct: pct(g.dbullHit, g.dbullAtt),

        // Moyennes & max
        avg3,
        first9,
        maxPts: g.bestVisit,

        // Bins
        s60: g.bins["60+"],
        s100: g.bins["100+"],
        s140: g.bins["140+"],
        s180: g.bins["180"],

        // Checkout
        hiCO: g.coHi,
        minDarts: g.minDarts,
        coPct,
      };
    });

    rows.sort((a, b) => (b.avg3 || 0) - (a.avg3 || 0));
    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  }, [records, nameMap]);

  const hasAnyStats = globals.length > 0;

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
                    rows={globals.map((p) => [
                      p.rank,
                      p.name,
                      p.darts ?? 0,
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
                    rows={globals.map((p) => [
                      p.rank,
                      p.name,
                      (p.avg3 ?? 0).toFixed(2),
                      p.first9 ? (p.first9 as number).toFixed(2) : "—",
                      p.maxPts || "—",
                    ])}
                  />
                </div>

                {/* Points (bins) */}
                <div style={card}>
                  <SectionHeader>Points</SectionHeader>
                  <DataTable
                    headers={["#", "Joueurs", "60+", "100+", "140+", "180"]}
                    rows={globals.map((p) => [p.rank, p.name, p.s60, p.s100, p.s140, p.s180])}
                  />
                </div>

                {/* Checkout */}
                <div style={card}>
                  <SectionHeader>Checkout</SectionHeader>
                  <DataTable
                    headers={["#", "Joueurs", "Max Checkout", "Min Darts", "Checkout %"]}
                    rows={globals.map((p) => [
                      p.rank,
                      p.name,
                      p.hiCO || 0,
                      p.minDarts ?? "—",
                      fmtPct(p.coPct),
                    ])}
                  />
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    onClick={() => {
                      if (confirm("Réinitialiser les stats calculées (re-scan de l'historique) ?")) {
                        // Pas de store séparé: on "recalcule" en rechargeant la page.
                        location.reload();
                      }
                    }}
                    style={dangerBtn}
                  >
                    Recalculer
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
