// ============================================
// src/pages/HistoryPage.tsx — Historique (onglets + sous-onglets temps)
// (EXTRAIT COMPLET avec correctif "Voir stats" -> x01_end)
// ============================================
import React, { useEffect, useMemo, useState } from "react";
import type { Store } from "../lib/types";

const T = {
  bg: "#0b0b0c", text: "#ffffff", text70: "rgba(255,255,255,.72)",
  edge: "rgba(255,255,255,.10)", card: "linear-gradient(180deg,rgba(17,18,20,.92),rgba(13,14,17,.90))",
  gold: "#F6C256", goldSoft: "rgba(246,194,86,.16)", red: "rgba(255,82,82,1)", redSoft: "rgba(255,82,82,.16)",
};
const S = {
  page: { minHeight: "100dvh", background: T.bg, color: T.text, paddingBottom: 96 } as React.CSSProperties,
  header: { position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(10px)", background: "rgba(0,0,0,.42)", borderBottom: `1px solid ${T.edge}` } as React.CSSProperties,
  headerRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "14px 16px", alignItems: "center" } as React.CSSProperties,
  h1: { fontSize: 26, fontWeight: 900, letterSpacing: .3 } as React.CSSProperties,
  tabsRow: { display: "flex", gap: 8, justifySelf: "end" } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px",
    borderRadius: 999, fontWeight: 800, fontSize: 13, letterSpacing: .3,
    border: `1px solid ${active ? "rgba(246,194,86,.55)" : T.edge}`,
    background: active ? T.goldSoft : "rgba(255,255,255,.06)", color: active ? T.gold : T.text, cursor: "pointer"
  }),
  subTabsWrap: { padding: "0 16px 12px 16px", borderBottom: `1px solid ${T.edge}`, background: "rgba(0,0,0,.28)", backdropFilter: "blur(6px)" } as React.CSSProperties,
  subTabsRow: { display: "flex", flexWrap: "wrap", gap: 8 } as React.CSSProperties,
  subTab: (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", height: 28, padding: "0 10px",
    borderRadius: 999, fontWeight: 800, fontSize: 12, letterSpacing: .3,
    border: `1px solid ${active ? "rgba(246,194,86,.45)" : T.edge}`,
    background: active ? "rgba(246,194,86,.12)" : "rgba(255,255,255,.06)",
    color: active ? T.gold : T.text, cursor: "pointer"
  }),
  list: { padding: 12, display: "grid", gap: 12, maxWidth: 760, margin: "0 auto" } as React.CSSProperties,
  card: { background: T.card, border: `1px solid ${T.edge}`, borderRadius: 18, padding: 14, boxShadow: "0 16px 40px rgba(0,0,0,.35)", backdropFilter: "blur(12px)" } as React.CSSProperties,
  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } as React.CSSProperties,
  chip: { display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px", borderRadius: 999, border: `1px solid ${T.edge}`, background: "rgba(255,255,255,.06)", fontSize: 12, fontWeight: 800, letterSpacing: .4 } as React.CSSProperties,
  chipGold: { border: `1px solid rgba(246,194,86,.55)`, background: T.goldSoft, color: T.gold } as React.CSSProperties,
  chipRed: { border: `1px solid rgba(255,82,82,.35)`, background: T.redSoft, color: T.red } as React.CSSProperties,
  date: { fontSize: 12, color: T.gold, fontWeight: 700 } as React.CSSProperties,
  sub: { fontSize: 12, color: T.text70 } as React.CSSProperties,
  avatars: { display: "flex", alignItems: "center" } as React.CSSProperties,
  avWrap: { width: 42, height: 42, borderRadius: "50%", overflow: "hidden", boxShadow: "0 0 0 2px rgba(0,0,0,.45)", marginLeft: -8, background: "rgba(255,255,255,.08)" } as React.CSSProperties,
  avImg: { width: "100%", height: "100%", objectFit: "cover" } as React.CSSProperties,
  avFallback: { width: "100%", height: "100%", display: "grid", placeItems: "center", fontWeight: 900, color: T.text70, fontSize: 14 } as React.CSSProperties,
  pillRow: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 } as React.CSSProperties,
  pill: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 999, border: `1px solid ${T.edge}`, background: "rgba(255,255,255,.08)", fontSize: 13, fontWeight: 800, cursor: "pointer" } as React.CSSProperties,
  pillGold: { border: `1px solid rgba(246,194,86,.55)`, background: T.goldSoft, color: T.gold } as React.CSSProperties,
  pillDanger: { border: `1px solid rgba(255,82,82,.35)`, background: T.redSoft, color: "rgba(255,170,170,1)" } as React.CSSProperties,
};

const Icon = {
  Trophy: (p: any) => (<svg viewBox="0 0 24 24" width={18} height={18} {...p}><path fill="currentColor" d="M6 2h12v2h3a1 1 0 0 1 1 1v1a5 5 0 0 1-5 5h-1.1A6 6 0 0 1 13 13.9V16h3v2H8v-2h3v-2.1A6 6 0 0 1 8.1 11H7A5 5 0 0 1 2 6V5a1 1 0 0 1 1-1h3V2Z"/></svg>),
  Eye:   (p: any) => (<svg viewBox="0 0 24 24" width={18} height={18} {...p}><path fill="currentColor" d="M12 5c5.5 0 9.5 4.5 10 7-0.5 2.5-4.5 7-10 7S2.5 14.5 2 12c.5-2.5 4.5-7 10-7Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/></svg>),
  Play:  (p: any) => (<svg viewBox="0 0 24 24" width={18} height={18} {...p}><path fill="currentColor" d="M8 5v14l11-7z"/></svg>),
  Trash: (p: any) => (<svg viewBox="0 0 24 24" width={18} height={18} {...p}><path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2Zm-3 6h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Z"/></svg>),
};

export type SavedEntry = {
  id: string;
  resumeId?: string;
  kind?: string;
  game?: { mode?: string; startScore?: number };
  createdAt: number;
  updatedAt?: number;
  players?: any[];
  winnerId?: string | null;
  winnerName?: string | null;
  status?: "finished" | "inprogress" | "in_progress" | "unknown";
  summary?: any;
  payload?: any;
};

function getId(v: any): string { if (!v) return ""; if (typeof v === "string") return v; return String(v.id || v.playerId || v.profileId || v._id || ""); }
function getName(v: any): string { if (!v) return ""; if (typeof v === "string") return v; return String(v.name || v.displayName || v.username || ""); }
function getAvatarUrl(store: Store, v: any): string | null {
  if (v && typeof v === "object" && v.avatarDataUrl) return String(v.avatarDataUrl);
  const id = getId(v);
  const anyStore: any = store as any;
  const list: any[] = Array.isArray(anyStore?.profiles) ? anyStore.profiles
    : Array.isArray(anyStore?.profiles?.list) ? anyStore.profiles.list : [];
  const hit = list.find((p) => getId(p) === id);
  return hit?.avatarDataUrl ?? null;
}
function baseMode(e: SavedEntry) { const k = (e.kind || "").toLowerCase(); const m = (e.game?.mode || "").toLowerCase(); if (k === "leg") return m || "x01"; return k || m || "x01"; }
function statusOf(e: SavedEntry): "finished" | "in_progress" {
  const s = (e.status || "").toLowerCase();
  if (s === "finished") return "finished";
  if (s === "inprogress" || s === "in_progress") return "in_progress";
  const sum = e.summary || e.payload || {};
  if (sum?.finished === true || sum?.result?.finished === true) return "finished";
  return "in_progress";
}
function modeLabel(e: SavedEntry) { const m = baseMode(e); if (m === "x01") { const sc = e.game?.startScore || 501; return `X01 · ${sc}`; } return m.toUpperCase(); }
function matchLink(e: SavedEntry): string | undefined {
  return e.resumeId || e.summary?.resumeId || e.summary?.matchId || e.payload?.resumeId || e.payload?.matchId;
}

/* --- dé-doublonnage & filtres --- */
function better(a: SavedEntry, b: SavedEntry): SavedEntry {
  const ta = a.updatedAt || a.createdAt || 0;
  const tb = b.updatedAt || b.createdAt || 0;
  if (ta !== tb) return ta > tb ? a : b;
  const sa = statusOf(a), sb = statusOf(b);
  if (sa !== sb) return sa === "finished" ? a : b;
  const ka = (a.kind || "").toLowerCase(); const kb = (b.kind || "").toLowerCase();
  if (ka !== kb) return ka === "leg" ? b : a;
  return a;
}
function sameBucket(a: SavedEntry, b: SavedEntry): boolean {
  if (baseMode(a) !== baseMode(b)) return false;
  const ta = a.updatedAt || a.createdAt || 0, tb = b.updatedAt || b.createdAt || 0;
  if (Math.abs(ta - tb) > 20 * 60 * 1000) return false;
  const A = new Set((a.players || []).map(getId).filter(Boolean));
  const B = new Set((b.players || []).map(getId).filter(Boolean));
  if (!A.size || !B.size) return true;
  for (const id of A) if (B.has(id)) return true;
  return false;
}
function dedupe(list: SavedEntry[]): SavedEntry[] {
  const byLink = new Map<string, SavedEntry>(); const rest: SavedEntry[] = [];
  for (const e of list) { const link = matchLink(e); if (link) byLink.set(link, byLink.has(link) ? better(byLink.get(link)!, e) : e); else rest.push(e); }
  const base = [...byLink.values(), ...rest];
  const buckets: { rep: SavedEntry }[] = [];
  for (const e of base.sort((a,b)=>(a.updatedAt||a.createdAt||0)-(b.updatedAt||b.createdAt||0))) {
    let ok = false; for (const bkt of buckets) { if (sameBucket(bkt.rep, e)) { bkt.rep = better(bkt.rep, e); ok = true; break; } }
    if (!ok) buckets.push({ rep: e });
  }
  return buckets.map((b)=>b.rep).sort((a,b)=>(b.updatedAt||b.createdAt)-(a.updatedAt||a.createdAt));
}

type RangeKey = "today" | "week" | "month" | "year" | "archives";
function startOfToday(d = new Date()) { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); }
function startOfWeek(d = new Date()) { const x = new Date(d); const day = (x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x.getTime(); }
function startOfMonth(d = new Date()) { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x.getTime(); }
function startOfYear(d = new Date()) { const x = new Date(d.getFullYear(), 0, 1); x.setHours(0,0,0,0); return x.getTime(); }
function inRange(ts: number, key: RangeKey): boolean {
  const t = ts || Date.now(), now = new Date();
  if (key === "today") return t >= startOfToday(now);
  if (key === "week") return t >= startOfWeek(now);
  if (key === "month") return t >= startOfMonth(now);
  if (key === "year") return t >= startOfYear(now);
  if (key === "archives") return t < startOfYear(now);
  return true;
}

const HistoryAPI = {
  async list(store: Store): Promise<SavedEntry[]> {
    const anyStore = store as any;
    if (Array.isArray(anyStore?.history)) return anyStore.history as SavedEntry[];
    if (typeof (window as any).History?.list === "function") return await (window as any).History.list();
    return [];
  },
  async remove(id: string): Promise<void> {
    if (typeof (window as any).History?.remove === "function") await (window as any).History.remove(id);
  },
};

export default function HistoryPage({ store, go }: { store: Store; go: (to: string, params?: any) => void; }) {
  const [tab, setTab] = useState<"done" | "running">("done");
  const [sub, setSub] = useState<RangeKey>("today");
  const [items, setItems] = useState<SavedEntry[]>([]);
  useEffect(() => { (async () => setItems(await HistoryAPI.list(store)))(); }, [store]);

  const all = useMemo(() => dedupe(items), [items]);
  const done = all.filter((e) => statusOf(e) === "finished");
  const running = all.filter((e) => statusOf(e) === "in_progress");
  const source = tab === "done" ? done : running;
  const filtered = source.filter((e) => inRange(e.updatedAt || e.createdAt, sub));

  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.headerRow}>
          <h1 style={S.h1}>Historique</h1>
          <div style={S.tabsRow}>
            <button style={S.tab(tab === "done")} onClick={() => setTab("done")}>Terminées</button>
            <button style={S.tab(tab === "running")} onClick={() => setTab("running")}>En cours</button>
          </div>
        </div>
        <div style={S.subTabsWrap}>
          <div style={S.subTabsRow}>
            <button style={S.subTab(sub === "today")} onClick={() => setSub("today")}>Aujourd’hui</button>
            <button style={S.subTab(sub === "week")} onClick={() => setSub("week")}>Cette semaine</button>
            <button style={S.subTab(sub === "month")} onClick={() => setSub("month")}>Ce mois-ci</button>
            <button style={S.subTab(sub === "year")} onClick={() => setSub("year")}>Cette année</button>
            <button style={S.subTab(sub === "archives")} onClick={() => setSub("archives")}>Archives</button>
          </div>
        </div>
      </header>

      <div style={S.list}>
        {filtered.map((e) => {
          const inProg = statusOf(e) === "in_progress";
          const key = String(matchLink(e) || e.id);
          return (
            <div key={key} style={S.card}>
              <div style={S.rowBetween}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...S.chip }}>{modeLabel(e)}</span>
                  <span style={{ ...S.chip, ...(inProg ? S.chipRed : S.chipGold) }}>
                    {inProg ? "En cours" : "Terminé"}
                  </span>
                </div>
                <span style={S.date}>{fmtDate(e.updatedAt || e.createdAt)}</span>
              </div>

              {/* avatars */}
              <div style={{ ...S.rowBetween, marginTop: 10 }}>
                <div style={S.avatars}>
                  {(e.players || []).slice(0, 6).map((p, i) => {
                    const id = getId(p) || String(i);
                    const nm = getName(p);
                    const url = getAvatarUrl(store, p);
                    return (
                      <div key={`${id}-${i}`} style={{ ...S.avWrap, marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }} title={nm}>
                        {url ? <img src={url} alt={nm || "avatar"} style={S.avImg} /> : <div style={S.avFallback}>{(nm || id || "?").slice(0, 2).toUpperCase()}</div>}
                      </div>
                    );
                  })}
                </div>

                {!inProg ? (
                  e.winnerName ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.gold, fontWeight: 900 }}>
                      <Icon.Trophy /> <span>{e.winnerName}</span>
                    </div>
                  ) : <div style={S.sub}>Partie terminée</div>
                ) : (
                  <div style={S.sub}>Partie non terminée</div>
                )}
              </div>

              {/* actions */}
              <div style={S.pillRow}>
                {inProg ? (
                  <>
                    <button
                      style={{ ...S.pill, ...S.pillGold }}
                      onClick={() => {
                        const resumeId = matchLink(e) || e.id;
                        const mode = baseMode(e);
                        if (mode === "x01") go("x01", { resumeId, players: e.players || [] });
                        else go("game", { mode, resumeId, players: e.players || [] });
                      }}
                    >
                      <Icon.Play /> Reprendre
                    </button>
                    <button
                      style={S.pill}
                      onClick={() => {
                        const resumeId = matchLink(e) || e.id;
                        const mode = baseMode(e);
                        if (mode === "x01") go("x01", { resumeId, players: e.players || [], preview: true });
                        else go("game", { mode, resumeId, players: e.players || [], preview: true });
                      }}
                    >
                      <Icon.Eye /> Voir
                    </button>
                  </>
                ) : (
                  <button
                    style={{ ...S.pill, ...S.pillGold }}
                    onClick={() => {
                      // ✅ ENVOI DIRECT DE L’OVERLAY AVEC LE RECORD COMPLET
                      const resumeId = matchLink(e) || e.id;
                      go("x01_end", {
                        rec: e,                 // record complet (summary/payload/winner/etc.)
                        resumeId,               // pour re-jouer depuis l’overlay
                        showEnd: true,          // force l’overlay
                        from: "history",
                      });
                    }}
                  >
                    <Icon.Eye /> Voir stats
                  </button>
                )}

                <button
                  style={{ ...S.pill, ...S.pillDanger }}
                  onClick={async () => {
                    if (confirm("Supprimer cette partie ?")) {
                      await HistoryAPI.remove(e.id);
                      setItems(await HistoryAPI.list(store));
                    }
                  }}
                >
                  <Icon.Trash /> Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtDate(ts: number) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" }).format(new Date(ts)); }
  catch { return new Date(ts).toLocaleString(); }
}
