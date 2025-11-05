// ============================================
// src/pages/StatsHub.tsx — Stats + Historique (safe)
// Sélecteur de joueurs AU-DESSUS du dashboard dans un bloc dépliant
// ============================================
import React from "react";
import { History } from "../lib/history";
import { loadStore } from "../lib/storage";
import StatsPlayerDashboard, {
  type PlayerDashboardStats,
} from "../components/StatsPlayerDashboard";
import { GoldPill, ProfilePill } from "../components/StatsPlayerDashboard";
import { useQuickStats } from "../hooks/useQuickStats";
import { getBasicProfileStats } from "../lib/statsBridge";
import HistoryPage from "./HistoryPage";

/* ---------- Thème local ---------- */
const T = {
  gold: "#F6C256",
  text: "#FFFFFF",
  text70: "rgba(255,255,255,.70)",
  edge: "rgba(255,255,255,.10)",
  card: "linear-gradient(180deg,rgba(17,18,20,.94),rgba(13,14,17,.92))",
};

/* ---------- Types ---------- */
type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };
type SavedMatch = {
  id: string;
  kind?: "x01" | "cricket" | string;
  status?: "in_progress" | "finished";
  players?: PlayerLite[];
  winnerId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  summary?: any;
  payload?: any;
};

type Props = {
  go?: (tab: string, params?: any) => void;
  tab?: "history" | "stats";
  memHistory?: SavedMatch[];
};

/* ---------- Helpers ---------- */
const toArr = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);
const toObj = <T,>(v: any): T =>
  v && typeof v === "object" ? (v as T) : ({} as T);
const N = (x: any, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
const fmtDate = (ts?: number) =>
  new Date(N(ts, Date.now())).toLocaleString();

/* ---------- Hooks ---------- */
function useHistoryAPI(): SavedMatch[] {
  const [rows, setRows] = React.useState<SavedMatch[]>([]);
  React.useEffect(() => {
    try {
      setRows(toArr<SavedMatch>(History.list?.()));
    } catch {
      setRows([]);
    }
  }, []);
  return rows;
}
function useStoreHistory(): SavedMatch[] {
  const [rows, setRows] = React.useState<SavedMatch[]>([]);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const store: any = await loadStore<any>();
        if (!mounted) return;
        setRows(toArr<SavedMatch>(store?.history));
      } catch {
        setRows([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return rows;
}

/* ---------- Adaptateur -> PlayerDashboardStats (fusion QUICK + historique) ---------- */
function buildDashboardForPlayer(
  player: PlayerLite,
  records: SavedMatch[],
  quick?: {
    avg3: number;
    bestVisit: number;
    bestCheckout?: number;
    winRatePct: number;
    buckets: Record<string, number>;
  } | null
): PlayerDashboardStats {
  const pid = player.id;
  const pname = player.name || "Joueur";

  // ---- Évolution des moyennes (historique)
  const evolution = records
    .filter((r) => toArr<PlayerLite>(r.players).some((p) => p.id === pid))
    .slice(0, 20)
    .map((r) => {
      const ss = toObj<any>(r.summary);
      const pstat =
        toObj<any>(ss.players)?.[pid] ??
        toObj<any>(ss.perPlayer)?.[pid] ??
        toObj<any>(ss)?.[pid] ??
        {};
      const v =
        Number(
          pstat.avg3 ?? pstat.avg_3 ?? pstat.avg3Darts ?? pstat.average3
        ) || (quick?.avg3 ?? 0);
      return {
        date: new Date(N(r.updatedAt ?? r.createdAt, Date.now())).toLocaleDateString(),
        avg3: v,
      };
    })
    .reverse();

  // ---- Distribution (buckets)
  const buckets =
    quick?.buckets
      ? {
          "0-59": N(quick.buckets["0-59"], 0),
          "60-99": N(quick.buckets["60-99"], 0),
          "100+": N(quick.buckets["100+"], 0),
          "140+": N(quick.buckets["140+"], 0),
          "180": N(quick.buckets["180"], 0),
        }
      : { "0-59": 0, "60-99": 0, "100+": 0, "140+": 0, "180": 0 };

  return {
    playerId: pid,
    playerName: pname,
    avg3Overall: (evolution[0]?.avg3 ?? quick?.avg3 ?? 0) || 0,
    bestVisit: quick?.bestVisit ?? 0,
    winRatePct: Number.isFinite(N(quick?.winRatePct)) ? N(quick?.winRatePct) : 0,
    bestCheckout: quick?.bestCheckout,
    evolution: evolution.length
      ? evolution
      : [{ date: new Date().toLocaleDateString(), avg3: quick?.avg3 ?? 0 }],
    distribution: buckets,
  };
}

/* ---------- Styles cartes/verre ---------- */
const card: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.edge}`,
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 26px rgba(0,0,0,.35)",
  backdropFilter: "blur(10px)",
};
const row: React.CSSProperties = {
  ...card,
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 8,
};

/* ---------- Page ---------- */
export default function StatsHub(props: Props) {
  const go = props.go ?? (() => {});
  const initialTab: "history" | "stats" =
    props.tab === "stats" ? "stats" : "history";
  const [tab, setTab] = React.useState<"history" | "stats">(initialTab);

  const persisted = useHistoryAPI();
  const mem = toArr<SavedMatch>(props.memHistory);
  const fromStore = useStoreHistory();

  const records = React.useMemo(() => {
    const byId = new Map<string, SavedMatch>();
    const push = (r: any) => {
      const rec = toObj<SavedMatch>(r);
      if (!rec.id) return;
      const prev = byId.get(rec.id);
      const curT = N(rec.updatedAt ?? rec.createdAt, 0);
      const prevT = N(prev?.updatedAt ?? prev?.createdAt, -1);
      if (!prev || curT > prevT) byId.set(rec.id, rec);
    };
    persisted.forEach(push);
    mem.forEach(push);
    fromStore.forEach(push);
    return Array.from(byId.values()).sort(
      (a, b) =>
        N(b.updatedAt ?? b.createdAt, 0) - N(a.updatedAt ?? a.createdAt, 0)
    );
  }, [persisted, mem, fromStore]);

  const players = React.useMemo<PlayerLite[]>(() => {
    const map = new Map<string, PlayerLite>();
    for (const r of records)
      for (const p of toArr<PlayerLite>(r.players)) {
        if (!p?.id) continue;
        if (!map.has(p.id))
          map.set(p.id, {
            id: p.id,
            name: p.name ?? `Joueur ${map.size + 1}`,
            avatarDataUrl: p.avatarDataUrl ?? null,
          });
      }
    return Array.from(map.values()).sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
  }, [records]);

  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(
    players[0]?.id ?? null
  );
  React.useEffect(() => {
    if (!selectedPlayerId && players[0]?.id) setSelectedPlayerId(players[0].id);
  }, [players, selectedPlayerId]);
  const selectedPlayer =
    players.find((p) => p.id === selectedPlayerId) || players[0];

  // ---- LIVE quick stats (store.*) pour le joueur sélectionné
  const quick = useQuickStats(selectedPlayer?.id || null);

  // bloc dépliant
  const [openPlayers, setOpenPlayers] = React.useState(true);

  return (
    <div className="container" style={{ padding: 12, maxWidth: 1100, color: T.text }}>
      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <GoldPill active={tab === "history"} onClick={() => setTab("history")}>
          Historique
        </GoldPill>
        <GoldPill active={tab === "stats"} onClick={() => setTab("stats")}>
          Stats
        </GoldPill>
      </div>

      {tab === "history" ? (
        // ⬇️ Remplacement : on monte la nouvelle page Historique
        <HistoryPage
          store={{ history: records } as any} // on réutilise les enregistrements fusionnés
          go={go}
        />
      ) : (
        <>
          {/* ===== Bloc dépliant Joueurs (au-dessus du dashboard) ===== */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontWeight: 800 }}>Joueurs ({players.length})</div>
              <GoldPill active={openPlayers} onClick={() => setOpenPlayers((o) => !o)}>
                {openPlayers ? "Replier" : "Déplier"}
              </GoldPill>
            </div>

            {openPlayers && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {players.length ? (
                  players.map((p) => (
                    <ProfilePill
                      key={p.id}
                      name={p.name || "Joueur"}
                      avatarDataUrl={p.avatarDataUrl || undefined}
                      active={p.id === selectedPlayer?.id}
                      onClick={() => setSelectedPlayerId(p.id)}
                    />
                  ))
                ) : (
                  <div style={{ color: T.text70, fontSize: 13 }}>
                    Aucun joueur détecté.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===== Dashboard joueur ===== */}
          {selectedPlayer ? (
            <StatsPlayerDashboard
              data={buildDashboardForPlayer(selectedPlayer, records, quick || null)}
            />
          ) : (
            <div style={card}>Sélectionne un joueur pour afficher ses stats.</div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Historique (ancien composant) ----------
   Conservé ci-dessous mais plus utilisé. Tu peux le supprimer plus tard si tu veux.
*/
function HistoryList({
  records,
  onOpen,
}: {
  records: SavedMatch[];
  onOpen: (r: SavedMatch) => void;
}) {
  if (!records.length) {
    return (
      <div style={card}>
        <div style={{ color: T.text70 }}>Aucun enregistrement pour l’instant.</div>
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {records.map((rec) => {
        const players = toArr<PlayerLite>(rec.players);
        const status = rec.status ?? "finished";
        const winnerId = rec.winnerId ?? null;
        const first = players[0]?.name || "—";
        const sub =
          players.length > 1 ? `${first} + ${players.length - 1} autre(s)` : first;
        return (
          <div key={rec.id} style={row}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: T.gold }}>
                {rec.kind?.toUpperCase?.() ?? "MATCH"} ·{" "}
                {status === "in_progress" ? "En cours" : "Terminé"}
              </div>
              <div
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: T.text70,
                }}
              >
                {sub}
              </div>
              <div style={{ color: T.text70 }}>
                {fmtDate(rec.updatedAt ?? rec.createdAt)}
              </div>
              {winnerId && (
                <div style={{ marginTop: 4 }}>
                  Vainqueur :{" "}
                  <b>{players.find((p) => p.id === winnerId)?.name ?? "—"}</b>
                </div>
              )}
            </div>
            <div>
              <GoldPill onClick={() => onOpen(rec)}>Voir</GoldPill>
            </div>
          </div>
        );
      })}
    </div>
  );
}
