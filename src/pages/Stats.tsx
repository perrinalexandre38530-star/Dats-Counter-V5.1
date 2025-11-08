// ============================================
// src/pages/Stats.tsx — Historique + Stats (lecture IDB)
// ============================================

import React from "react";
import { History } from "../lib/history";
import {
  getBasicProfileStats,
  getBasicProfileStatsSync,
  type BasicProfileStats,
} from "../lib/statsLiteIDB";

/* -------------------- Types -------------------- */
type Row = {
  id: string;
  kind?: string;
  status?: "in_progress" | "finished";
  players?: { id: string; name?: string }[];
  winnerId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  summary?: {
    legs?: number;
    darts?: number;
    avg3ByPlayer?: Record<string, number>;
    co?: number;
  } | null;
};

/* -------------------- Page -------------------- */
export default function StatsPage() {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [byPlayer, setByPlayer] = React.useState<Record<string, BasicProfileStats>>({}); // map playerId -> stats

  const load = React.useCallback(async () => {
    try {
      const list = (await History.list()) as Row[];
      setRows(list);

      // Collecter tous les playerIds visibles
      const ids = Array.from(
        new Set(
          list.flatMap((r) => (Array.isArray(r.players) ? r.players.map((p) => p.id) : []))
        )
      ).slice(0, 128);

      // Pré-remplir depuis le mini-cache sync (affichage instantané)
      const seed: Record<string, BasicProfileStats> = {};
      for (const id of ids) {
        seed[id] = getBasicProfileStatsSync(id);
      }
      setByPlayer(seed);

      // Puis rafraîchir depuis IDB (async, robuste)
      const refreshed: Record<string, BasicProfileStats> = { ...seed };
      await Promise.all(
        ids.map(async (id) => {
          try {
            refreshed[id] = await getBasicProfileStats(id);
          } catch {
            // no-op
          }
        })
      );
      setByPlayer(refreshed);
    } catch {
      setRows([]);
    }
  }, []);

  React.useEffect(() => {
    load();
    const onUpd = () => load();
    window.addEventListener("dc-history-updated", onUpd);
    return () => window.removeEventListener("dc-history-updated", onUpd);
  }, [load]);

  if (rows === null) {
    return <div style={{ padding: 16, color: "#aaa" }}>Chargement…</div>;
  }

  // Construire une liste "par joueur" (nom à partir du dernier match où il apparaît)
  const nameById = buildNameIndex(rows);
  const perPlayerRows = Object.keys(byPlayer).map((id) => ({
    id,
    name: nameById[id] || id,
    ...byPlayer[id],
  }));
  perPlayerRows.sort((a, b) => (b.avg3 || 0) - (a.avg3 || 0));

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      {/* ======= Stats par joueur (agrégées) ======= */}
      <h2 style={{ fontWeight: 900, fontSize: 20, marginBottom: 12 }}>Stats par joueur</h2>

      {perPlayerRows.length === 0 ? (
        <div style={{ opacity: 0.7 }}>Aucune statistique disponible.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 6,
            gridTemplateColumns:
              "minmax(120px,1fr) 90px 80px 80px 80px 80px 80px",
            alignItems: "center",
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,.06)",
            background:
              "linear-gradient(180deg, rgba(22,22,26,.95), rgba(14,14,18,.98))",
          }}
        >
          <HeadCell>Joueur</HeadCell>
          <HeadCell>Moy/3D</HeadCell>
          <HeadCell>Darts</HeadCell>
          <HeadCell>Games</HeadCell>
          <HeadCell>Win%</HeadCell>
          <HeadCell>Best</HeadCell>
          <HeadCell>Best CO</HeadCell>

          {perPlayerRows.map((r) => (
            <React.Fragment key={r.id}>
              <Cell bold>{r.name}</Cell>
              <Cell mono>{fmt1(r.avg3 ?? 0)}</Cell>
              <Cell mono>{r.darts ?? 0}</Cell>
              <Cell mono>{r.games ?? 0}</Cell>
              <Cell mono>{fmtPct(r.winRate ?? 0)}</Cell>
              <Cell mono>{r.bestVisit ?? 0}</Cell>
              <Cell mono>{r.bestCheckout ?? 0}</Cell>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ======= Historique des matchs ======= */}
      <h2 style={{ fontWeight: 900, fontSize: 20, margin: "18px 0 12px" }}>Historique</h2>

      {!rows.length && (
        <div style={{ opacity: 0.7 }}>Aucune partie enregistrée pour l’instant.</div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => {
          const when = r.createdAt ? new Date(r.createdAt).toLocaleString() : "";
          const co = r.summary?.co ?? 0;
          return (
            <div
              key={r.id}
              style={{
                borderRadius: 12,
                background:
                  "linear-gradient(180deg, rgba(20,20,26,.55), rgba(14,14,18,.75))",
                padding: 12,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>
                  {r.kind?.toUpperCase() || "MATCH"}
                </div>
                <div style={{ opacity: 0.7 }}>{when}</div>
              </div>

              <div style={{ marginTop: 6, opacity: 0.9, fontSize: 13 }}>
                {r.players?.map((p) => (
                  <span key={p.id} style={{ marginRight: 8 }}>
                    {p.name || p.id}
                    {r.winnerId === p.id ? " 🏆" : ""}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                Legs: {r.summary?.legs ?? 0} · Darts: {r.summary?.darts ?? 0} · CO: {co}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------- UI helpers -------------------- */
function HeadCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        opacity: 0.75,
        padding: "4px 2px",
        borderBottom: "1px solid rgba(255,255,255,.06)",
      }}
    >
      {children}
    </div>
  );
}
function Cell({
  children,
  mono,
  bold,
}: {
  children: React.ReactNode;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        padding: "6px 2px",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
        fontWeight: bold ? 800 : 600,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------- Utils -------------------- */
function fmt1(n: number) {
  return (Math.round((n ?? 0) * 10) / 10).toFixed(1);
}
function fmtPct(n: number) {
  const v = Math.round((n ?? 0) * 10) / 10; // déjà en %
  return `${v}%`;
}
function buildNameIndex(rows: Row[]) {
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (!Array.isArray(r.players)) continue;
    for (const p of r.players) {
      if (p?.id) map[p.id] = p.name || map[p.id] || p.id;
    }
  }
  return map;
}
