// ============================================
// src/pages/X01End.tsx — Fin de partie robuste (MATCH ou LEG)
// ============================================
import React from "react";
import { History } from "../lib/history";

type PlayerLite = { id: string; name?: string; avatarDataUrl?: string | null };

type Props = {
  go: (tab: string, params?: any) => void;
  params?: {
    matchId?: string;
    resumeId?: string | null;
    rec?: any;          // record passé directement
    showEnd?: boolean;
  };
};

export default function X01End({ go, params }: Props) {
  const [rec, setRec] = React.useState<any | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (params?.rec) { mounted && setRec(params.rec); return; }
        if (params?.matchId) {
          const byId = (History as any)?.get?.(params.matchId);
          if (byId) { mounted && setRec(byId); return; }
        }
        const mem = (window as any)?.__appStore?.history as any[] | undefined;
        if (mem?.length) {
          if (params?.matchId) {
            const m = mem.find((r) => r?.id === params.matchId);
            if (m) { mounted && setRec(m); return; }
          }
          const lastFin = [...mem].find((r) => r?.status === "finished");
          if (lastFin) { mounted && setRec(lastFin); return; }
        }
        mounted && setErr("Impossible de charger l'enregistrement.");
      } catch (e) {
        console.warn("[X01End] load error:", e);
        mounted && setErr("Erreur de chargement.");
      }
    })();
    return () => { mounted = false; };
  }, [params?.matchId, params?.rec]);

  if (err) {
    return (
      <Shell go={go} title="Fin de partie">
        <p style={{ color: "#bbb" }}>{err}</p>
      </Shell>
    );
  }
  if (!rec) return <Shell go={go}><p style={{ color: "#bbb" }}>Chargement…</p></Shell>;

  const when = num(rec.updatedAt ?? rec.createdAt ?? Date.now());
  const dateStr = new Date(when).toLocaleString();
  const players: PlayerLite[] =
    rec.players?.length ? rec.players : (rec.payload?.players || []);

  const winnerId: string | null =
    rec.winnerId ?? rec.payload?.winnerId ?? rec.summary?.winnerId ?? null;
  const winnerName =
    (winnerId && (players.find((p) => p.id === winnerId)?.name || null)) || null;

  // 1) summary de match (playerStats.ts) si présent
  const matchSummary = rec.summary && rec.summary.kind === "x01" ? rec.summary : null;

  // 2) sinon, tente de construire un résumé à partir d'un LEG
  const legSummary = !matchSummary ? buildSummaryFromLeg(rec) : null;

  return (
    <Shell go={go} title={`${String(rec.kind || "MATCH").toUpperCase()} — ${dateStr}`} resumeId={params?.resumeId}>
      <div style={{ opacity: 0.85, marginBottom: 10 }}>
        Joueurs : {players.map((p) => p?.name || "—").join(" · ") || "—"}
      </div>
      {winnerName && (
        <div style={{ marginBottom: 14, fontWeight: 800, color: "#ffcf57" }}>
          🏆 Vainqueur : {winnerName}
        </div>
      )}

      {matchSummary ? (
        <SummaryTable summary={matchSummary} />
      ) : legSummary ? (
        <>
          <div style={{ ...card(), marginBottom: 10, color: "#bbb" }}>
            <b>Résumé (manche)</b> — reconstruit depuis les statistiques de la manche.
          </div>
          <SummaryTable summary={legSummary} />
        </>
      ) : (
        <div style={card()}>
          <h3 style={{ marginTop: 0 }}>Résumé</h3>
          <div style={{ color: "#bbb" }}>
            Aucun résumé détaillé n’a été trouvé.
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ======== Fallback LEG → summary x01-like ======== */
function buildSummaryFromLeg(rec: any) {
  // Cherche d'abord un calcul riche __legStats (computeLegStats)
  const leg = rec?.payload?.__legStats || rec?.__legStats;
  const per = leg?.perPlayer;
  const list = leg?.players;

  const now = Date.now();
  const make = (rows: Array<{ id: string; name?: string }>, get: (id: string) => any) => {
    const players: any = {};
    for (const p of rows) {
      const s = get(p.id) || {};
      const darts = num(s.dartsThrown ?? s.darts);
      const visits = num(s.visits);
      const points = num(s.pointsScored, (num(s.avg3) / 3) * (darts || visits * 3));

      players[p.id] = {
        id: p.id,
        name: p.name || "—",
        avg3: num(s.avg3),
        bestVisit: num(s.bestVisit),
        bestCheckout: num(s.highestCheckout ?? s.bestCheckout),
        darts: darts || (visits ? visits * 3 : 0),
        win: !!s.win || (rec?.winnerId ? rec.winnerId === p.id : false),
        buckets: s.buckets && Object.keys(s.buckets).length ? s.buckets : undefined,
        updatedAt: now,
        matches: 1,
        legs: 1,
        _sumPoints: points,
        _sumDarts: darts || (visits ? visits * 3 : 0),
        _sumVisits: visits || undefined,
      };
    }
    return { kind: "x01", winnerId: rec?.winnerId ?? null, players, updatedAt: now };
  };

  if (per && Array.isArray(list)) {
    return make(
      list.map((id: string) => ({ id, name: rec.players?.find((p: any) => p.id === id)?.name })),
      (id: string) => per[id] || {}
    );
  }

  // Legacy fields présents directement sur payload/result
  const ids: string[] = Object.keys(rec?.payload?.avg3 || rec?.avg3 || {});
  if (ids.length) {
    const rows = ids.map((id) => ({ id, name: rec.players?.find((p: any) => p.id === id)?.name }));
    const get = (id: string) => ({
      avg3: pick(rec, ["payload.avg3."+id, "avg3."+id]),
      bestVisit: pick(rec, ["payload.bestVisit."+id, "bestVisit."+id]),
      bestCheckout: pick(rec, ["payload.bestCheckout."+id, "bestCheckout."+id]),
      darts: pick(rec, ["payload.darts."+id, "darts."+id]),
      visits: pick(rec, ["payload.visits."+id, "visits."+id]),
      buckets: undefined,
    });
    return make(rows, get);
  }
  return null;
}

/* ======= UI bits ======= */
function SummaryTable({ summary }: { summary: any }) {
  return (
    <div style={card()}>
      <h3 style={{ marginTop: 0 }}>Résumé par joueur</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 8 }}>
        <div style={th()}>Joueur</div>
        <div style={th()}>Moy/3D</div>
        <div style={th()}>Best visit</div>
        <div style={th()}>Best CO</div>
        <div style={th()}>Darts</div>
        {Object.keys(summary.players).map((pid) => {
          const p = summary.players[pid];
          return (
            <React.Fragment key={pid}>
              <div style={td(p.win ? "#7fe2a9" : undefined)}>{p.name || "—"}{p.win ? " (win)" : ""}</div>
              <div style={td()}>{fix(p.avg3)}</div>
              <div style={td()}>{fix(p.bestVisit, 0)}</div>
              <div style={td()}>{fix(p.bestCheckout, 0)}</div>
              <div style={td()}>{fix(p.darts, 0)}</div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function Shell({ go, title, children, resumeId }: any) {
  return (
    <div style={{ padding: 16, maxWidth: 620, margin: "0 auto" }}>
      <button onClick={() => go("stats", { tab: "history" })} style={btn()}>
        ← Retour
      </button>
      <h2 style={{ margin: "12px 0 6px" }}>{title || "Fin de partie"}</h2>
      {children}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => go("stats", { tab: "history" })} style={btn()}>
          ← Retour à l’historique
        </button>
        {resumeId && (
          <button onClick={() => go("x01", { resumeId })} style={btnGold()}>
            Reprendre
          </button>
        )}
      </div>
    </div>
  );
}

function btn(): React.CSSProperties {
  return { borderRadius: 10, padding: "6px 12px", border: "1px solid rgba(255,255,255,.12)", background: "transparent", color: "#e8e8ec", fontWeight: 700, cursor: "pointer" };
}
function btnGold(): React.CSSProperties {
  return { borderRadius: 10, padding: "6px 12px", border: "1px solid rgba(255,180,0,.3)", background: "linear-gradient(180deg,#ffc63a,#ffaf00)", color: "#141417", fontWeight: 900, cursor: "pointer", boxShadow: "0 10px 22px rgba(255,170,0,.28)" };
}
function card(): React.CSSProperties {
  return { padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "linear-gradient(180deg, rgba(22,22,26,.96), rgba(14,14,16,.98))" };
}
function th(): React.CSSProperties { return { fontWeight: 800, color: "#ffcf57", padding: "4px 0" }; }
function td(color?: string): React.CSSProperties { return { padding: "2px 0", color: color || "#e8e8ec" }; }
function num(x: any, d = Date.now()) { const n = Number(x); return Number.isFinite(n) ? n : d; }
function fix(x: any, d = 0) { const n = Number(x); if (!Number.isFinite(n)) return String(d); return Math.abs(n) < 1000 && n !== (n | 0) ? n.toFixed(2) : String(n | 0); }
function pick(obj: any, paths: string[]) {
  for (const p of paths) {
    const segs = p.split(".");
    let cur = obj;
    let ok = true;
    for (const s of segs) {
      if (cur == null) { ok = false; break; }
      if (s.includes("+")) { ok = false; break; }
      if (s.includes("[")) { ok = false; break; }
      if (s in cur) cur = cur[s]; else { ok = false; break; }
    }
    if (ok) return cur;
  }
  return undefined;
}
