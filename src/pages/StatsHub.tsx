// ============================================
// src/pages/StatsHub.tsx — Stats + Historique (safe + OPFS)
// - Demande la persistance (si pas déjà accordée)
// - Lit l'historique lourd dans OPFS et le fusionne avec History
// - Corrige les .map sur undefined (helpers toArr / toObj / safeNumber)
// ============================================

import React from "react";
import { History } from "../lib/history";
import { ensurePersisted, estimate, readJSON } from "../lib/deviceStore";

// --- Types légers (compat) ---
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
};

/* ---------- helpers sûrs ---------- */
function toArr<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function toObj<T = any>(v: any): T {
  return v && typeof v === "object" ? (v as T) : ({} as T);
}
function safeNumber(n: any, def = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}
function fmtDate(ts?: number) {
  const d = new Date(safeNumber(ts, Date.now()));
  return d.toLocaleString();
}

/* ---------- récupération safe History (IndexedDB/local) ---------- */
function useHistorySafe() {
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

/* ---------- récupération OPFS (fichier gzip/json) ---------- */
function useOpfsHistory(path = "history/x01/history.json") {
  const [rows, setRows] = React.useState<SavedMatch[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Demander la persistance ici (OK si déjà accordée)
        await ensurePersisted();
        // (facultatif) log quota/usage en console
        estimate().then((e) => console.log("Storage quota/usage:", e));

        const fileData = await readJSON<SavedMatch[] | SavedMatch>(path);
        const arr = toArr<SavedMatch>(fileData);
        if (!cancelled) setRows(arr);
      } catch (e) {
        console.warn("[StatsHub] OPFS read error:", e);
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return rows;
}

export default function StatsHub(props: StatsHubProps) {
  const go = props.go ?? (() => {});
  const [tab, setTab] = React.useState<"history" | "stats">("history");

  const hx = useHistorySafe();               // History classique
  const hxOpfs = useOpfsHistory();           // Historique lourd OPFS (peut être null le temps du chargement)

  // Fusion + dédup par id, priorité à OPFS (données plus “fraîches”/complètes)
  const records = React.useMemo<SavedMatch[]>(() => {
    const a = toArr<SavedMatch>(hx);
    const b = toArr<SavedMatch>(hxOpfs ?? []);
    const byId = new Map<string, SavedMatch>();
    for (const r of a) if (r?.id) byId.set(r.id, toObj<SavedMatch>(r));
    for (const r of b) if (r?.id) byId.set(r.id, toObj<SavedMatch>(r)); // écrase si même id
    const merged = Array.from(byId.values());
    merged.sort(
      (x, y) =>
        safeNumber(y.updatedAt ?? y.createdAt, 0) -
        safeNumber(x.updatedAt ?? x.createdAt, 0)
    );
    return merged;
  }, [hx, hxOpfs]);

  return (
    <div className="container" style={{ padding: 12, maxWidth: 900 }}>
      {/* onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          className="btn sm"
          style={tab === "history" ? sel : un}
          onClick={() => setTab("history")}
        >
          Historique
        </button>
        <button
          className="btn sm"
          style={tab === "stats" ? sel : un}
          onClick={() => setTab("stats")}
        >
          Stats
        </button>
      </div>

      {tab === "history" ? (
        <HistoryList
          loading={hxOpfs === null}         // null pendant le fetch OPFS
          records={records}
          onOpen={(rec) => {
            const kind = rec.kind || "x01";
            // Adapte cette navigation à ton routeur
            if (kind === "x01") go("x01stats", { id: rec.id });
          }}
        />
      ) : (
        <StatsPlaceholder />
      )}
    </div>
  );
}

/* ---------- sous-composants ---------- */

function HistoryList({
  loading,
  records,
  onOpen,
}: {
  loading: boolean;
  records: SavedMatch[];
  onOpen: (r: SavedMatch) => void;
}) {
  if (loading) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.08)",
          background:
            "linear-gradient(180deg, rgba(18,18,22,.95), rgba(12,12,16,.95))",
        }}
      >
        <div className="subtitle">Chargement des données…</div>
      </div>
    );
  }

  if (!records.length) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.08)",
          background:
            "linear-gradient(180deg, rgba(18,18,22,.95), rgba(12,12,16,.95))",
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
        const sub =
          players.length > 1 ? `${first} + ${players.length - 1} autre(s)` : first;

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
              background:
                "linear-gradient(180deg, rgba(18,18,22,.95), rgba(12,12,16,.95))",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: "#ffcf57" }}>
                {rec.kind?.toUpperCase?.() ?? "MATCH"}
                {" · "}
                {status === "in_progress" ? "En cours" : "Terminé"}
              </div>
              <div
                className="subtitle"
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {sub}
              </div>
              <div className="subtitle" style={{ opacity: 0.8 }}>
                {fmtDate(rec.updatedAt ?? rec.createdAt)}
              </div>
              {winnerId && (
                <div className="subtitle" style={{ marginTop: 4 }}>
                  Vainqueur :{" "}
                  <b>
                    {toArr<PlayerLite>(rec.players).find((p) => p.id === winnerId)?.name ??
                      "—"}
                  </b>
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
        background:
          "linear-gradient(180deg, rgba(18,18,22,.95), rgba(12,12,16,.95))",
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
