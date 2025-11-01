// ============================================
// src/pages/StatsHub.tsx — Stats + Historique (ultra safe)
// Lit depuis 3 sources et fusionne :
//  - History API (IndexedDB propre au module History)
//  - memHistory (passé par App depuis store.history en RAM)
//  - Store persistant (storage.ts) -> store.history
// ============================================
import React from "react";
import { History } from "../lib/history";
import { loadStore } from "../lib/storage";

// --- Types légers ---
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

type StatsHubProps = {
  go?: (tab: string, params?: any) => void;
  tab?: "history" | "stats";
  memHistory?: SavedMatch[]; // ← App passe store.history ici
};

// --- helpers sûrs ---
const toArr = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);
const toObj = <T,>(v: any): T => (v && typeof v === "object" ? (v as T) : ({} as T));
const n = (x: any, d = 0) => {
  const v = Number(x);
  return Number.isFinite(v) ? v : d;
};
const fmtDate = (ts?: number) => new Date(n(ts, Date.now())).toLocaleString();

// History API (sécurisé)
function useHistoryAPI(): SavedMatch[] {
  const [rows, setRows] = React.useState<SavedMatch[]>([]);
  React.useEffect(() => {
    try {
      const api: any = History || {};
      const list =
        toArr<SavedMatch>(api.list?.()) ||
        toArr<SavedMatch>(api.getAll?.()) ||
        toArr<SavedMatch>(api.items ?? []);
      setRows(list);
    } catch {
      setRows([]);
    }
  }, []);
  return rows;
}

// Store/IndexedDB (storage.ts)
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

export default function StatsHub(props: StatsHubProps) {
  const go = props.go ?? (() => {});
  const initialTab: "history" | "stats" = props.tab === "stats" ? "stats" : "history";
  const [tab, setTab] = React.useState<"history" | "stats">(initialTab);

  const persisted = useHistoryAPI();          // 1) History API
  const mem = toArr<SavedMatch>(props.memHistory); // 2) mémoire depuis App
  const fromStore = useStoreHistory();        // 3) Store/IndexedDB

  // Fusion 1+2+3 (id unique, le plus récent gagne)
  const records = React.useMemo(() => {
    const byId = new Map<string, SavedMatch>();
    const push = (r: any) => {
      const rec = toObj<SavedMatch>(r);
      if (!rec.id) return;
      const prev = byId.get(rec.id);
      const curDate = n(rec.updatedAt ?? rec.createdAt, 0);
      const prevDate = n(prev?.updatedAt ?? prev?.createdAt, -1);
      if (!prev || curDate > prevDate) byId.set(rec.id, rec);
    };
    persisted.forEach(push);
    mem.forEach(push);
    fromStore.forEach(push);
    return Array.from(byId.values()).sort(
      (a, b) => n(b.updatedAt ?? b.createdAt, 0) - n(a.updatedAt ?? a.createdAt, 0)
    );
  }, [persisted, mem, fromStore]);

  return (
    <div className="container" style={{ padding: 12, maxWidth: 900 }}>
      {/* onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button className="btn sm" style={tab === "history" ? sel : un} onClick={() => setTab("history")}>
          Historique
        </button>
        <button className="btn sm" style={tab === "stats" ? sel : un} onClick={() => setTab("stats")}>
          Stats
        </button>
      </div>

      {tab === "history" ? (
        <HistoryList
          records={records}
          onOpen={(rec) => go("statsDetail", { matchId: rec.id })}
        />
      ) : (
        <StatsPlaceholder />
      )}
    </div>
  );
}

/* ---------- sous-composants ---------- */

function HistoryList({
  records,
  onOpen,
}: {
  records: SavedMatch[];
  onOpen: (r: SavedMatch) => void;
}) {
  if (!records.length) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.08)",
          background: "linear-gradient(180deg, rgba(18,18,22,.95), rgba(12,12,16,.95))",
        }}
      >
        <div className="subtitle">Aucun enregistrement pour l’instant.</div>
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
        const sub = players.length > 1 ? `${first} + ${players.length - 1} autre(s)` : first;

        return (
          <div
            key={rec.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.08)",
              background: "linear-gradient(180deg, rgba(18,18,22,.95), rgba(12,12,16,.95))",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: "#ffcf57" }}>
                {rec.kind?.toUpperCase?.() ?? "MATCH"} · {status === "in_progress" ? "En cours" : "Terminé"}
              </div>
              <div className="subtitle" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {sub}
              </div>
              <div className="subtitle" style={{ opacity: 0.8 }}>
                {fmtDate(rec.updatedAt ?? rec.createdAt)}
              </div>
              {winnerId && (
                <div className="subtitle" style={{ marginTop: 4 }}>
                  Vainqueur : <b>{players.find((p) => p.id === winnerId)?.name ?? "—"}</b>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn sm" onClick={() => onOpen(rec)}>
                Voir
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatsPlaceholder() {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,.08)",
        background: "linear-gradient(180deg, rgba(18,18,22,.95), rgba(12,12,16,.95))",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Stats</div>
      <div className="subtitle">À venir : tableaux détaillés, graphiques, etc.</div>
    </div>
  );
}

/* ---------- styles onglets ---------- */
const sel: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,187,51,.4)",
  background: "rgba(255,187,51,.12)",
  color: "#ffc63a",
  fontWeight: 800,
};
const un: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.10)",
  background: "transparent",
  color: "#e8e8ec",
  fontWeight: 700,
};
