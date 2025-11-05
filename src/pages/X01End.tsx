// ============================================
// src/pages/X01End.tsx — Fin de partie stylée (LEG/MATCH)
// - Bouton "Reprendre" masqué si partie terminée
// - Table compacte + stats bonus : 180 / 140+ / 100+ / 60+
//   + Doubles / Triples / Bulls + Visits / Points + Checkout%
// - Lecture robuste (summary -> legStats -> legacy payload)
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
          const lastFin = [...mem].find((r) => String(r?.status).toLowerCase() === "finished");
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
        <Notice>{err}</Notice>
      </Shell>
    );
  }
  if (!rec) return <Shell go={go}><Notice>Chargement…</Notice></Shell>;

  const status = normalizeStatus(rec);
  const finished = status === "finished";

  const when = num(rec.updatedAt ?? rec.createdAt ?? Date.now());
  const dateStr = new Date(when).toLocaleString();
  const players: PlayerLite[] =
    rec.players?.length ? rec.players : (rec.payload?.players || []);

  const winnerId: string | null =
    rec.winnerId ?? rec.payload?.winnerId ?? rec.summary?.winnerId ?? null;
  const winnerName =
    (winnerId && (players.find((p) => p.id === winnerId)?.name || null)) || null;

  // 1) summary normalisé (playerStats.ts)
  const matchSummary = rec.summary && rec.summary.kind === "x01" ? rec.summary : null;

  // 2) fallback depuis __legStats ou legacy
  const legSummary = !matchSummary ? buildSummaryFromLeg(rec) : null;

  const title = (rec?.kind === "x01" || rec?.kind === "leg" ? "LEG" : String(rec?.kind || "Fin").toUpperCase()) + " — " + dateStr;

  // Extras (buckets + impacts doubles/triples/bulls + visits/points/checkout)
  const extrasByPlayer: Record<string, Extras> =
    extractExtras(rec, matchSummary || legSummary);

  return (
    <Shell go={go} title={title} canResume={!finished} resumeId={params?.resumeId}>
      {/* Bandeau titre + vainqueur */}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800, color: "#e8e8ec" }}>
            Joueurs : {players.map((p) => p?.name || "—").join(" · ") || "—"}
          </div>
          {winnerName && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#ffcf57", fontWeight: 900 }}>
              <Trophy /> <span>{winnerName}</span>
            </div>
          )}
        </div>
      </Panel>

      {/* Résumé compact */}
      {matchSummary ? (
        <StatsTable summary={matchSummary} extras={extrasByPlayer} />
      ) : legSummary ? (
        <>
          <InfoCard><b>Résumé (manche)</b> — reconstruit depuis les statistiques de la manche.</InfoCard>
          <StatsTable summary={legSummary} extras={extrasByPlayer} />
        </>
      ) : (
        <Panel>
          <h3 style={{ margin: "0 0 8px" }}>Résumé</h3>
          <p style={{ margin: 0, color: "#bbb" }}>Aucun résumé détaillé n’a été trouvé.</p>
        </Panel>
      )}
    </Shell>
  );
}

/* ============ Reconstruction LEG → summary x01-like ============ */
function buildSummaryFromLeg(rec: any) {
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

      const rawCO = s.bestCheckoutScore ?? s.highestCheckout ?? s.bestCheckout;
      const bestCO = sanitizeCheckout(rawCO);

      players[p.id] = {
        id: p.id,
        name: p.name || "—",
        avg3: num(s.avg3),
        bestVisit: num(s.bestVisit),
        bestCheckout: bestCO,
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

  // Legacy (avg3/darts/visits/bestVisit/bestCheckout directement sur payload/result)
  const ids: string[] = Object.keys(rec?.payload?.avg3 || rec?.avg3 || {});
  if (ids.length) {
    const rows = ids.map((id) => ({ id, name: rec.players?.find((p: any) => p.id === id)?.name }));
    const get = (id: string) => ({
      avg3: pick(rec, ["payload.avg3."+id, "avg3."+id]),
      bestVisit: pick(rec, ["payload.bestVisit."+id, "bestVisit."+id]),
      bestCheckout: sanitizeCheckout(
        pick(rec, ["payload.bestCheckout."+id, "bestCheckout."+id])
      ),
      darts: pick(rec, ["payload.darts."+id, "darts."+id]),
      visits: pick(rec, ["payload.visits."+id, "visits."+id]),
      buckets: undefined,
    });
    return make(rows, get);
  }
  return null;
}

/* ================== Extras (buckets & impacts) ================== */
type Extras = {
  t180: number; t140: number; t100: number; t60: number;
  doubles: number; triples: number; bulls: number;
  visits: number; points: number;
  coHits: number; coAtt: number; coPct: number;
};

function extractExtras(rec: any, summary: any | null): Record<string, Extras> {
  const out: Record<string, Extras> = {};
  const per = rec?.payload?.__legStats?.perPlayer || rec?.__legStats?.perPlayer || {};
  const players = Object.keys(summary?.players || {});
  for (const pid of players) {
    const s = summary?.players?.[pid] || {};
    const pRich = per?.[pid] || {};

    const buckets = s.buckets || {};
    const t180 = num(buckets["180"], pick(rec, ["payload.h180."+pid, "h180."+pid], 0));
    const t140 = num(buckets["140+"], pick(rec, ["payload.h140."+pid, "h140."+pid], 0));
    const t100 = num(buckets["100+"], pick(rec, ["payload.h100."+pid, "h100."+pid], 0));
    const t60  = num(buckets["60+"],  pick(rec, ["payload.h60."+pid,  "h60."+pid], 0));

    // impacts
    const doubles = num(
      pRich.doubles,
      pick(rec, ["payload.doubles."+pid, "doubles."+pid], 0)
    );
    const triples = num(
      pRich.triples,
      pick(rec, ["payload.triples."+pid, "triples."+pid], 0)
    );
    const bulls = num(
      pRich.bulls,
      pick(rec, ["payload.bulls."+pid, "bulls."+pid], 0)
    );

    // visites / points
    const visits = num(
      pRich.visits ?? s._sumVisits,
      pick(rec, ["payload.visits."+pid, "visits."+pid], 0)
    );
    const points = num(
      pRich.pointsScored ?? s._sumPoints,
      pick(rec, ["payload.pointsScored."+pid, "pointsScored."+pid], 0)
    );

    // checkout
    const coHits = num(
      pRich.checkoutHits,
      pick(rec, ["payload.checkoutHits."+pid, "checkoutHits."+pid], 0)
    );
    const coAtt = num(
      pRich.checkoutAttempts,
      pick(rec, ["payload.checkoutAttempts."+pid, "checkoutAttempts."+pid], 0)
    );
    const coPct = coAtt > 0 ? Math.round((coHits / coAtt) * 100) : 0;

    out[pid] = { t180, t140, t100, t60, doubles, triples, bulls, visits, points, coHits, coAtt, coPct };
  }
  return out;
}

/* ================== UI — Table compacte ================== */
function StatsTable({ summary, extras }: { summary: any; extras: Record<string, Extras>}) {
  return (
    <Panel style={{ padding: 12 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 15, letterSpacing: 0.2, color: "#ffcf57" }}>Résumé par joueur</h3>

      {/* Table compactée */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto auto",
          gap: 6,
          fontSize: 12.5,
          lineHeight: 1.2,
          alignItems: "center",
        }}
      >
        <HeadCell>Joueur</HeadCell>
        <HeadCell>Moy/3D</HeadCell>
        <HeadCell>Best visit</HeadCell>
        <HeadCell>Best CO</HeadCell>
        <HeadCell>Darts</HeadCell>

        {Object.keys(summary.players).map((pid) => {
          const p = summary.players[pid];
          const bestCO = sanitizeCheckout(p.bestCheckoutScore ?? p.highestCheckout ?? p.bestCheckout);
          const ex = extras[pid] || ({} as Extras);

          return (
            <React.Fragment key={pid}>
              <Cell style={{ textAlign: "left", color: p.win ? "#7fe2a9" : "#e8e8ec" }}>
                {p.name || "—"}{p.win ? " (win)" : ""}
              </Cell>
              <Cell>{to2(p.avg3)}</Cell>
              <Cell>{i0(p.bestVisit)}</Cell>
              <Cell>{i0(bestCO)}</Cell>
              <Cell>{i0(p.darts)}</Cell>

              {/* Chips Hits (ligne 1) */}
              <div style={{ gridColumn: "1 / -1", margin: "2px 0 2px" }}>
                <ChipsRow items={[
                  ["180", ex.t180 || 0],
                  ["140+", ex.t140 || 0],
                  ["100+", ex.t100 || 0],
                  ["60+", ex.t60 || 0],
                ]}/>
              </div>

              {/* Chips Impacts + volumes (ligne 2) */}
              <div style={{ gridColumn: "1 / -1", margin: "0 0 6px" }}>
                <ChipsRow items={[
                  ["Doubles", ex.doubles || 0],
                  ["Triples", ex.triples || 0],
                  ["Bulls", ex.bulls || 0],
                  ["Visits", ex.visits || 0],
                  ["Points", ex.points || 0],
                  ["CO%", ex.coPct || 0],
                  ["CO", ex.coHits || 0],       // hits
                  ["Att.", ex.coAtt || 0],      // attempts
                ]}/>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </Panel>
  );
}

/* ================== Shell & styles ================== */
function Shell({ go, title, children, canResume, resumeId }: any) {
  return (
    <div style={{ padding: 16, maxWidth: 620, margin: "0 auto" }}>
      <button onClick={() => go("stats", { tab: "history" })} style={btn()}>← Retour</button>
      <h2 style={{ margin: "12px 0 10px", letterSpacing: 0.3 }}>{title || "Fin de partie"}</h2>
      {children}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => go("stats", { tab: "history" })} style={btn()}>← Retour à l’historique</button>
        {canResume && resumeId && (
          <button onClick={() => go("x01", { resumeId })} style={btnGold()}>Reprendre</button>
        )}
      </div>
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,.08)",
        background:
          "radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.06), transparent 55%), linear-gradient(180deg, rgba(22,22,26,.96), rgba(14,14,16,.98))",
        boxShadow: "0 18px 46px rgba(0,0,0,.35)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Petit encart informatif
function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <Panel style={{ color: "#bbb", padding: 10, margin: "8px 0" }}>
      {children}
    </Panel>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Panel>
      <div style={{ color: "#bbb" }}>{children}</div>
    </Panel>
  );
}

function ChipsRow({ items }: { items: [string, number][] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map(([label, val]) => (
        <div
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 26,
            padding: "0 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.08)",
            background: "rgba(255,255,255,.06)",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.2,
            color: "#e8e8ec",
          }}
        >
          <span style={{ color: "#ffcf57" }}>{label}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{i0(val)}</span>
        </div>
      ))}
    </div>
  );
}

function HeadCell({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 800, color: "#ffcf57", padding: "3px 0" }}>{children}</div>;
}
function Cell({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ padding: "2px 0", color: "#e8e8ec", textAlign: "right", fontVariantNumeric: "tabular-nums", ...style }}>{children}</div>;
}

/* ================== Icons ================== */
function Trophy(props: any) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} {...props}>
      <path fill="currentColor" d="M6 2h12v2h3a1 1 0 0 1 1 1v1a5 5 0 0 1-5 5h-1.1A6 6 0 0 1 13 13.9V16h3v2H8v-2h3v-2.1A6 6 0 0 1 8.1 11H7A5 5 0 0 1 2 6V5a1 1 0 0 1 1-1h3V2Z"/>
    </svg>
  );
}

/* ================== Utils ================== */
function normalizeStatus(rec: any): "finished" | "in_progress" {
  const s = String(rec?.status || "").toLowerCase();
  if (s === "finished") return "finished";
  if (s === "inprogress" || s === "in_progress") return "in_progress";
  const sum = rec?.summary || rec?.payload || {};
  if (sum?.finished === true || sum?.result?.finished === true) return "finished";
  return "in_progress";
}
function sanitizeCheckout(v: any): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n);
  if (r === 50) return 50;
  if (r >= 2 && r <= 170) return r;
  return 0;
}
function btn(): React.CSSProperties {
  return { borderRadius: 10, padding: "6px 12px", border: "1px solid rgba(255,255,255,.12)", background: "transparent", color: "#e8e8ec", fontWeight: 700, cursor: "pointer" };
}
function btnGold(): React.CSSProperties {
  return { borderRadius: 10, padding: "6px 12px", border: "1px solid rgba(255,180,0,.3)", background: "linear-gradient(180deg,#ffc63a,#ffaf00)", color: "#141417", fontWeight: 900, cursor: "pointer", boxShadow: "0 10px 22px rgba(255,170,0,.28)" };
}
function num(x: any, d = 0) { const n = Number(x); return Number.isFinite(n) ? n : d; }
function to2(x: any) { const v = Number(x); return Number.isFinite(v) ? v.toFixed(2) : "0.00"; }
function i0(x: any) { const n = Number(x); return Number.isFinite(n) ? (n | 0) : 0; }
function pick(obj: any, paths: string[], def?: any) {
  for (const p of paths) {
    const segs = p.split(".");
    let cur = obj;
    let ok = true;
    for (const s of segs) {
      if (cur == null) { ok = false; break; }
      if (s in cur) cur = cur[s]; else { ok = false; break; }
    }
    if (ok) return cur;
  }
  return def;
}
