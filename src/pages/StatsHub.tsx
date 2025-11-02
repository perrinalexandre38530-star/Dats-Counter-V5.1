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
const toObj = <T,>(v: any): T => (v && typeof v === "object" ? (v as T) : ({} as T));
const N = (x: any, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);
const fmtDate = (ts?: number) => new Date(N(ts, Date.now())).toLocaleString();

/* ---------- Hooks ---------- */
function useHistoryAPI(): SavedMatch[] {
  const [rows, setRows] = React.useState<SavedMatch[]>([]);
  React.useEffect(() => {
    try { setRows(toArr<SavedMatch>(History.list?.())); } catch { setRows([]); }
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
      } catch { setRows([]); }
    })();
    return () => { mounted = false; };
  }, []);
  return rows;
}

/* ---------- Adaptateur -> PlayerDashboardStats ---------- */
function buildDashboardForPlayer(player: PlayerLite, records: SavedMatch[]): PlayerDashboardStats {
  const pid = player.id;
  const pname = player.name || "Joueur";

  const perPlayer: any = (() => {
    for (const r of records) {
      const s = toObj<any>(r.summary);
      const a = toObj<any>(s.players)?.[pid];
      const b = toObj<any>(s.perPlayer)?.[pid];
      const c = toObj<any>(s)?.[pid];
      if (a) return a; if (b) return b; if (c) return c;
    }
    return {};
  })();

  const avg3Overall = Number(perPlayer.avg3 ?? perPlayer.avg_3 ?? perPlayer.avg3Darts ?? perPlayer.average3 ?? 0) || 0;
  const bestVisit = Number(perPlayer.bestVisit ?? perPlayer.bestScore ?? perPlayer.max ?? 0) || 0;
  const wins = N(perPlayer.wins, NaN), games = N(perPlayer.games, NaN);
  const winRatePct = Number.isFinite(wins)&&Number.isFinite(games)&&games>0 ? (wins/games)*100 : Number(perPlayer.winRatePct ?? perPlayer.winrate ?? 0);
  const bestCheckout = perPlayer.bestCheckout!=null ? Number(perPlayer.bestCheckout) : (perPlayer.coMax!=null ? Number(perPlayer.coMax) : undefined);

  const evolution = records
    .filter(r => toArr<PlayerLite>(r.players).some(p=>p.id===pid))
    .slice(0, 20)
    .map(r=>{
      const ss = toObj<any>(r.summary);
      const pstat = toObj<any>(ss.players)?.[pid] ?? toObj<any>(ss.perPlayer)?.[pid] ?? toObj<any>(ss)?.[pid] ?? {};
      const v = Number(pstat.avg3 ?? pstat.avg_3 ?? pstat.avg3Darts ?? pstat.average3) || 56;
      return { date: new Date(N(r.updatedAt ?? r.createdAt, Date.now())).toLocaleDateString(), avg3: v };
    })
    .reverse();

  const buckets = toObj<any>(perPlayer.buckets);
  const distribution = {
    "0-59": N(buckets.b0_59, Math.max(0, 100 - Math.floor(bestVisit/2))),
    "60-99": N(buckets.b60_99, 50 - Math.floor(bestVisit/6)),
    "100+": N(buckets.b100p, Math.floor(bestVisit/30)),
    "140+": N(buckets.b140p, Math.floor(bestVisit/60)),
    "180": N(buckets.b180, bestVisit>=180 ? 1 : 0),
  } as const;

  return {
    playerId: pid,
    playerName: pname,
    avg3Overall: evolution[0]?.avg3 ?? avg3Overall ?? 56.6,
    bestVisit: bestVisit || 180,
    winRatePct: Number.isFinite(winRatePct) ? winRatePct : 50,
    bestCheckout,
    evolution: evolution.length ? evolution : [
      { date: "03/10/2025", avg3: 62 },
      { date: "08/10/2025", avg3: 48 },
      { date: "12/10/2025", avg3: 78 },
      { date: "16/10/2025", avg3: 52 },
      { date: "20/10/2025", avg3: 57 },
    ],
    distribution,
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
const row: React.CSSProperties = { ...card, display:"grid", gridTemplateColumns:"1fr auto", alignItems:"center", gap:8 };

/* ---------- Page ---------- */
export default function StatsHub(props: Props) {
  const go = props.go ?? (()=>{});
  const initialTab: "history"|"stats" = props.tab === "stats" ? "stats" : "history";
  const [tab, setTab] = React.useState<"history"|"stats">(initialTab);

  const persisted = useHistoryAPI();
  const mem = toArr<SavedMatch>(props.memHistory);
  const fromStore = useStoreHistory();

  const records = React.useMemo(() => {
    const byId = new Map<string, SavedMatch>();
    const push = (r:any) => {
      const rec = toObj<SavedMatch>(r);
      if (!rec.id) return;
      const prev = byId.get(rec.id);
      const curT = N(rec.updatedAt ?? rec.createdAt, 0);
      const prevT = N(prev?.updatedAt ?? prev?.createdAt, -1);
      if (!prev || curT > prevT) byId.set(rec.id, rec);
    };
    persisted.forEach(push); mem.forEach(push); fromStore.forEach(push);
    return Array.from(byId.values()).sort((a,b)=> N(b.updatedAt ?? b.createdAt,0) - N(a.updatedAt ?? a.createdAt,0));
  }, [persisted, mem, fromStore]);

  const players = React.useMemo<PlayerLite[]>(() => {
    const map = new Map<string, PlayerLite>();
    for (const r of records) for (const p of toArr<PlayerLite>(r.players)) {
      if (!p?.id) continue;
      if (!map.has(p.id)) map.set(p.id, { id:p.id, name:p.name ?? `Joueur ${map.size+1}`, avatarDataUrl:p.avatarDataUrl ?? null });
    }
    return Array.from(map.values()).sort((a,b)=>(a.name||"").localeCompare(b.name||""));
  }, [records]);

  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(players[0]?.id ?? null);
  React.useEffect(()=>{ if (!selectedPlayerId && players[0]?.id) setSelectedPlayerId(players[0].id); },[players, selectedPlayerId]);
  const selectedPlayer = players.find(p=>p.id===selectedPlayerId) || players[0];

  // bloc dépliant
  const [openPlayers, setOpenPlayers] = React.useState(true);

  return (
    <div className="container" style={{ padding: 12, maxWidth: 1100, color: T.text }}>
      {/* Onglets */}
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        <GoldPill active={tab==="history"} onClick={()=>setTab("history")}>Historique</GoldPill>
        <GoldPill active={tab==="stats"} onClick={()=>setTab("stats")}>Stats</GoldPill>
      </div>

      {tab === "history" ? (
        <HistoryList records={records} onOpen={(rec)=>go("statsDetail",{ matchId: rec.id })}/>
      ) : (
        <>
          {/* ===== Bloc dépliant Joueurs (au-dessus du dashboard) ===== */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontWeight:800 }}>Joueurs ({players.length})</div>
              <GoldPill active={openPlayers} onClick={()=>setOpenPlayers(o=>!o)}>
                {openPlayers ? "Replier" : "Déplier"}
              </GoldPill>
            </div>

            {openPlayers && (
              <div style={{ marginTop: 10, display:"flex", flexWrap:"wrap", gap:8 }}>
                {players.length ? (
                  players.map(p=>(
                    <ProfilePill
                      key={p.id}
                      name={p.name || "Joueur"}
                      avatarDataUrl={p.avatarDataUrl || undefined}
                      active={p.id === selectedPlayer?.id}
                      onClick={()=>setSelectedPlayerId(p.id)}
                    />
                  ))
                ) : (
                  <div style={{ color: T.text70, fontSize: 13 }}>Aucun joueur détecté.</div>
                )}
              </div>
            )}
          </div>

          {/* ===== Dashboard joueur ===== */}
          {selectedPlayer ? (
            <StatsPlayerDashboard data={buildDashboardForPlayer(selectedPlayer, records)} />
          ) : (
            <div style={card}>Sélectionne un joueur pour afficher ses stats.</div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Historique ---------- */
function HistoryList({ records, onOpen }: { records: SavedMatch[]; onOpen: (r: SavedMatch) => void; }) {
  if (!records.length) {
    return <div style={card}><div style={{ color:T.text70 }}>Aucun enregistrement pour l’instant.</div></div>;
  }
  return (
    <div style={{ display:"grid", gap:10 }}>
      {records.map((rec)=>{
        const players = toArr<PlayerLite>(rec.players);
        const status = rec.status ?? "finished";
        const winnerId = rec.winnerId ?? null;
        const first = players[0]?.name || "—";
        const sub = players.length>1 ? `${first} + ${players.length-1} autre(s)` : first;
        return (
          <div key={rec.id} style={row}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:800, color:T.gold }}>
                {rec.kind?.toUpperCase?.() ?? "MATCH"} · {status==="in_progress" ? "En cours" : "Terminé"}
              </div>
              <div style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:T.text70 }}>{sub}</div>
              <div style={{ color:T.text70 }}>{fmtDate(rec.updatedAt ?? rec.createdAt)}</div>
              {winnerId && (
                <div style={{ marginTop:4 }}>
                  Vainqueur : <b>{players.find(p=>p.id===winnerId)?.name ?? "—"}</b>
                </div>
              )}
            </div>
            <div><GoldPill onClick={()=>onOpen(rec)}>Voir</GoldPill></div>
          </div>
        );
      })}
    </div>
  );
}
