// ============================================
// src/pages/X01Play.tsx
// Header sticky, Keypad fixed, Checkout centré sous la volée
// Sons (dart/bust), vibration, TTS (volée & fin de partie)
// Avatar agrandi + NOM sous l’avatar (médaillon avec fondu)
// Mini-Stats sous l’avatar + mini-Classement sous la volée
// Bouton QUITTER doré
// + Reprise/sauvegarde Historique (History.upsert + resumeId)
// + CONTINUER jusqu’à l’avant-dernier + Overlay Classement/Stats de manche
// + Garde-fou: différer onFinish pour laisser voir le classement
// + Construction/sauvegarde Stats de match (saveMatchStats)
// + Commit auto des stats globales à chaque fin de manche (commitLegStatsOnce)
// + SFX intégrés (double/triple/bull/DBull/180 + touches Keypad)
// + Log de volées + computeLegStats()/aggregateMatch()
// + Affichage Set/Leg — UNIQUEMENT dans la barre du haut (à côté de Quitter)
// ❗️Paramétrage en amont (X01Setup) + lecture robuste (router/global)
// ============================================

import React from "react";
import { useX01Engine } from "../hooks/useX01Engine";
import Keypad from "../components/Keypad";
import EndOfLegOverlay from "../components/EndOfLegOverlay";
import { playSound } from "../lib/sound";

// Historique
import { History, type SavedMatch } from "../lib/history";

// ===== (A) Imports StatsBridge demandés =====
import type { Visit, PlayerLite } from "../lib/types";
import { StatsBridge } from "../lib/statsBridge";

// Stats locales riches (on garde, pour compat interne si besoin ponctuel)
import * as StatsOnce from "../lib/statsOnce";
import { saveMatchStats, aggregateMatch } from "../lib/stats";
import { addMatchSummary } from "../lib/statsLiteIDB";

// Résumé cumulable
import { commitMatchSummary, buildX01Summary } from "../lib/playerStats";

// ===== [STATS LITE] : agrégats persistants légers en IndexedDB =====
import { addMatchSummary as addLiteSummary } from "../lib/statsLiteIDB";

// Types app
import type {
  Profile,
  MatchRecord,
  Dart as UIDart,
  LegResult,
  FinishPolicy,
  X01Snapshot,
} from "../lib/types";

/* ---------- Helper anti-typo : EnginePlayer[] -> PlayerLite[] ---------- */
function mapEnginePlayersToLite(
  enginePlayers: Array<{ id: string; name: string }>,
  profiles: Profile[]
): PlayerLite[] {
  return (enginePlayers || []).map((p) => ({
    id: p.id,
    name: p.name || "",
    avatarDataUrl: (profiles.find((pr) => pr.id === p.id)?.avatarDataUrl ?? null) as string | null,
  }));
}

/* --- helper pour % --- */
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

/* ---------- Helpers Dernière volée (tolérant à la source) ---------- */
type SegLite = { v: number; mult?: 1 | 2 | 3 };
type VisitLite = { p: string; segments: SegLite[]; bust?: boolean; score?: number; ts?: number };

function findVisitsSrc(src: any): VisitLite[] {
  return (
    src?.__visits ||
    src?.visits ||
    src?.log?.visits ||
    src?.payload?.__visits ||
    src?.payload?.visits ||
    []
  );
}
function lastVisitForPlayer(src: any, pid: string): VisitLite | null {
  const all = findVisitsSrc(src).filter((v: any) => v?.p === pid);
  return all.length ? all[all.length - 1] : null;
}
function segLabel(seg: SegLite) {
  const v = Number(seg?.v || 0);
  const m = Number(seg?.mult || 1);
  if (v === 0) return "Miss";
  if (v === 25) return m === 2 ? "DBull" : "Bull";
  if (m === 3) return `T${v}`;
  if (m === 2) return `D${v}`;
  return String(v);
}
export function lastVisitLabel(src: any, pid: string): string {
  const v = lastVisitForPlayer(src, pid);
  if (!v) return "—";
  const s = (Array.isArray(v.segments) ? v.segments : []).map(segLabel).join(" · ") || "—";
  return v.bust ? (s !== "—" ? `${s}  (Bust)` : "Bust") : s;
}

/* ---------------------------------------------
   Helpers visuels partagés (au niveau module)
----------------------------------------------*/
function fmt(d?: UIDart) {
  if (!d) return "—";
  if (d.v === 0) return "MISS";
  if (d.v === 25) return d.mult === 2 ? "DBULL" : "BULL";
  const prefix = d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S";
  return `${prefix}${d.v}`;
}
function chipStyle(d?: UIDart, red = false): React.CSSProperties {
  if (!d)
    return {
      background: "rgba(255,255,255,.06)",
      color: "#bbb",
      border: "1px solid rgba(255,255,255,.08)",
    };
  if (red)
    return {
      background: "rgba(200,30,30,.18)",
      color: "#ff8a8a",
      border: "1px solid rgba(255,80,80,.35)",
    };
  if (d.v === 25 && d.mult === 2)
    return {
      background: "rgba(13,160,98,.18)",
      color: "#8ee6bf",
      border: "1px solid rgba(13,160,98,.35)",
    };
  if (d.v === 25)
    return {
      background: "rgba(13,160,98,.12)",
      color: "#7bd6b0",
      border: "1px solid rgba(13,160,98,.3)",
    };
  if (d.mult === 3)
    return {
      background: "rgba(179,68,151,.18)",
      color: "#ffd0ff",
      border: "1px solid rgba(179,68,151,.35)",
    };
  if (d.mult === 2)
    return {
      background: "rgba(46,150,193,.18)",
      color: "#cfeaff",
      border: "1px solid rgba(46,150,193,.35)",
    };
  return {
    background: "rgba(255,187,51,.12)",
    color: "#ffc63a",
    border: "1px solid rgba(255,187,51,.4)",
  };
}

/** Pastilles "dernière volée" au même style que le header — null si rien */
function renderLastVisitChips(src: any, pid: string) {
  const v = lastVisitForPlayer(src, pid);
  if (!v || !Array.isArray(v.segments) || v.segments.length === 0) return null;

  const chipBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    height: 24,
    padding: "0 10px",
    borderRadius: 10,
    fontWeight: 800,
    fontSize: 12,
    marginRight: 6,
  };

  const chips = v.segments.map((s, i) => {
    const d = { v: Number(s?.v || 0), mult: Number(s?.mult || 1) as 1 | 2 | 3 };
    const st = chipStyle(d as any);
    return (
      <span
        key={i}
        style={{
          ...chipBase,
          border: st.border as string,
          background: st.background as string,
          color: st.color as string,
        }}
      >
        {fmt(d as any)}
      </span>
    );
  });

  if (v.bust) {
    const st = chipStyle(undefined as any, true);
    chips.push(
      <span
        key="__bust"
        style={{
          ...chipBase,
          border: st.border as string,
          background: st.background as string,
          color: st.color as string,
        }}
      >
        Bust
      </span>
    );
  }

  return <span style={{ display: "inline-flex", flexWrap: "wrap" }}>{chips}</span>;
}

/* ---- Autres types/constantes ---- */
type EnginePlayer = { id: string; name: string };
type RankItem = { id: string; name: string; score: number };
type Mode = "simple" | "double" | "master";

/* ---- Dimensions & layout ---- */
const NAV_HEIGHT = 64;
const KEYPAD_HEIGHT = 260;
const KEYPAD_SCALE = 0.88;
const CONTENT_MAX = 520;

/* ---- UI tweaks ---- */
const HEADER_SCALE = 0.94;
const AVATAR_SIZE = 108;
const MINI_CARD_HEIGHT = 86;
const MINI_CARD_WIDTH = 180;
const HEADER_OUTER_PADDING = 12;

const PLAYER_ROW_AVATAR = 36;
const PLAYER_ROW_PAD_Y = 8;
const PLAYER_ROW_GAP = 10;
const PLAYERS_BLOCK_PADDING = 10;
const PLAYERS_LIST_MAX_H_VH = 32;

/* ---------------------------------------------
   Lecture robuste des paramètres de départ
----------------------------------------------*/
type StartParams = {
  playerIds: string[];
  start: 301 | 501 | 701 | 901;
  outMode?: Mode;
  inMode?: Mode;
  setsToWin?: number;
  legsPerSet?: number;
  finishPolicy?: FinishPolicy;
  officialMatch?: boolean;
  resume?: X01Snapshot | null;
};
function readStartParams(
  propIds: string[] | undefined,
  propStart: 301 | 501 | 701 | 901 | undefined,
  propOut: Mode | undefined,
  propIn: Mode | undefined,
  propSets?: number,
  propLegs?: number,
  params?: any
): StartParams {
  const fromProps: Partial<StartParams> = {
    playerIds: propIds || [],
    start: (propStart as any) || 501,
    outMode: propOut,
    inMode: propIn,
    setsToWin: propSets,
    legsPerSet: propLegs,
  };
  const fromParams: Partial<StartParams> = (params?.startParams ?? {}) as Partial<StartParams>;
  const fromGlobal: Partial<StartParams> =
    (typeof window !== "undefined" && (window as any).__x01StartParams) || {};

  const merged: StartParams = {
    playerIds: fromParams.playerIds ?? fromGlobal.playerIds ?? fromProps.playerIds ?? [],
    start: (fromParams.start ?? fromGlobal.start ?? fromProps.start ?? 501) as 301 | 501 | 701 | 901,
    outMode: (fromParams.outMode ?? fromGlobal.outMode ?? fromProps.outMode ?? "double") as Mode,
    inMode: (fromParams.inMode ?? fromGlobal.inMode ?? fromProps.inMode ?? "simple") as Mode,
    setsToWin: fromParams.setsToWin ?? fromGlobal.setsToWin ?? fromProps.setsToWin ?? 1,
    legsPerSet: fromParams.legsPerSet ?? fromGlobal.legsPerSet ?? fromProps.legsPerSet ?? 1,
    finishPolicy:
      (fromParams.finishPolicy ??
        fromGlobal.finishPolicy ??
        ("firstToZero" as FinishPolicy)) as FinishPolicy,
    officialMatch: fromParams.officialMatch ?? fromGlobal.officialMatch ?? false,
    resume: (fromParams.resume ?? fromGlobal.resume ?? null) as X01Snapshot | null,
  };
  return merged;
}

/* ---- Checkout (raccourci minimal) ---- */
const SINGLE_SET = new Set<number>([...Array(20).keys()].map((n) => n + 1).concat([25, 50]));
function suggestCheckout(rest: number, doubleOut: boolean, dartsLeft: 1 | 2 | 3): string[] {
  if (rest < 2 || rest > 170) return [];
  if (dartsLeft === 1) {
    if (doubleOut) {
      if (rest === 50) return ["DBULL"];
      if (rest % 2 === 0 && rest / 2 >= 1 && rest / 2 <= 20) return [`D${rest / 2}`];
      return [];
    } else {
      if (SINGLE_SET.has(rest)) return [rest === 50 ? "BULL" : rest === 25 ? "25" : `S${rest}`];
      return [];
    }
  }
  const res: string[] = [];
  const push = (s: string) => res.push(s);
  if (!doubleOut) {
    if (rest <= 50 && SINGLE_SET.has(rest)) push(rest === 50 ? "BULL" : rest === 25 ? "25" : `S${rest}`);
    const tryTwo = (label: string, pts: number) => {
      const r = rest - pts;
      if (SINGLE_SET.has(r)) push(`${label} S${r}`);
    };
    tryTwo("T20", 60);
    tryTwo("T19", 57);
    tryTwo("T18", 54);
    tryTwo("50", 50);
    tryTwo("25", 25);
  } else {
    const map: Record<number, string> = {
      170: "T20 T20 D25",
      167: "T20 T19 D25",
      164: "T20 T18 D25",
      161: "T20 T17 D25",
      160: "T20 T20 D20",
      158: "T20 T20 D19",
      157: "T20 T19 D20",
      156: "T20 T20 D18",
      155: "T20 T19 D19",
      154: "T20 T18 D20",
      153: "T20 T19 D18",
      152: "T20 T20 D16",
      151: "T20 T17 D20",
      150: "T20 T18 D18",
      140: "T20 T20 D10",
      139: "T20 T13 D20",
      138: "T20 T18 D12",
      137: "T20 T15 D16",
      136: "T20 T20 D8",
      135: "T20 T17 D12",
      130: "T20 T18 D8",
      129: "T19 T16 D12",
      128: "T18 T14 D16",
      127: "T20 T17 D8",
      126: "T19 T19 D6",
      125: "25 T20 D20",
      124: "T20 T16 D8",
      123: "T19 T16 D9",
      122: "T18 T18 D7",
      121: "T20 11 D25",
      120: "T20 D20",
      119: "T19 10 D25",
      118: "T20 18 D20",
      117: "T20 17 D20",
      116: "T20 16 D20",
      115: "T20 15 D20",
      110: "T20 10 D20",
      109: "T20 9 D20",
      108: "T20 16 D16",
      107: "T19 18 D16",
      101: "T20 9 D16",
      100: "T20 D20",
      99: "T19 10 D16",
      98: "T20 D19",
      97: "T19 D20",
      96: "T20 D18",
      95: "T19 D19",
      94: "T18 D20",
      93: "T19 D18",
      92: "T20 D16",
      91: "T17 D20",
      90: "T18 D18",
      89: "T19 D16",
      88: "T16 D20",
      87: "T17 D18",
      86: "T18 D16",
      85: "T15 D20",
      84: "T16 D18",
      83: "T17 D16",
      82: "BULL D16",
      81: "T15 D18",
      80: "T20 D10",
      79: "T19 D11",
      78: "T18 D12",
      77: "T19 D10",
      76: "T20 D8",
      75: "T17 D12",
      74: "T14 D16",
      73: "T19 D8",
      72: "T16 D12",
      71: "T13 D16",
      70: "T20 D5",
    };
    const best = map[rest];
    if (best && best.split(" ").length <= dartsLeft) res.push(best);
  }
  return res.slice(0, 1);
}

/* --------- Composant --------- */
export default function X01Play({
  profiles = [],
  playerIds = [],
  start = 501,
  outMode = "double",
  inMode = "simple",
  onFinish,
  onExit,
  params,
  setsToWin = 1,
  legsPerSet = 1,
}: {
  profiles?: Profile[];
  playerIds?: string[];
  start?: 301 | 501 | 701 | 901;
  outMode?: Mode;
  inMode?: Mode;
  onFinish: (m: MatchRecord) => void;
  onExit: () => void;
  params?: { resumeId?: string; startParams?: StartParams } | any;
  setsToWin?: number;
  legsPerSet?: number;
}) {
  // ======= Fusion finale des paramètres (props/params/global) =======
  const merged = readStartParams(
    playerIds,
    start as any,
    outMode,
    inMode,
    setsToWin,
    legsPerSet,
    params
  );
  const effectivePlayerIds = merged.playerIds;
  const startScore = merged.start;
  const outM = merged.outMode as Mode;
  const inM = merged.inMode as Mode;
  const setsTarget = merged.setsToWin ?? 1;
  const legsTarget = merged.legsPerSet ?? 1;
  const finishPref = merged.finishPolicy as FinishPolicy;

  const resumeId: string | undefined = params?.resumeId;

  // Reprise snapshot X01 (depuis l’historique ou via merged.resume)
  const resumeSnapshot = React.useMemo<X01Snapshot | null>(() => {
    if (merged.resume) return merged.resume as X01Snapshot;
    if (!resumeId) return null;
    const rec: SavedMatch | null | undefined =
      (History as any).getX01 ? (History as any).getX01(resumeId) : History.get(resumeId);
    if (!rec || rec.kind !== "x01") return null;
    const snap = (rec.payload as any)?.state as X01Snapshot | undefined;
    return snap ?? null;
  }, [resumeId, merged.resume]);

  // ===== Overlay de manche
  const [lastLegResult, setLastLegResult] = React.useState<any | null>(null);
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  // ===== Log volées (source pour StatsBridge.makeLeg)
  const [visitsLog, setVisitsLog] = React.useState<VisitLite[]>([]);
  const visitNoRef = React.useRef<number>(0);
  const matchLegsRef = React.useRef<any[]>([]); // (B) on empile les legs pour le match

  function pushVisitLog(visit: any) {
    setVisitsLog((prev) => {
      const arr = [...(prev || [])];
      const segs =
        Array.isArray(visit?.darts)
          ? visit.darts.map((d: UIDart) => ({ v: Number(d?.v || 0), mult: Number(d?.mult || 1) }))
          : Array.isArray((visit as any)?.segments)
          ? (visit as any).segments.map((s: any) => ({ v: Number(s?.v || 0), mult: Number(s?.mult || 1) }))
          : null;

      arr.push({
        p: visit.playerId,
        score: Number(visit.score || 0) as any,
        // @ts-ignore
        remainingAfter: Number((visit as any).remainingAfter || 0),
        // @ts-ignore
        isCheckout: !!visit.isCheckout,
        // @ts-ignore
        bust: !!visit.bust,
        // @ts-ignore
        segments: segs,
      } as any);
      return arr;
    });
  }

  // ===== onFinish différé
  const [pendingFinish, setPendingFinish] = React.useState<MatchRecord | null>(null);
  const defaultFinishPolicy: FinishPolicy =
    finishPref ?? ((safeGetLocalStorage("opt_continue_policy") ?? "firstToZero") as FinishPolicy);

  // ====== Hook moteur
  const {
    state,
    currentPlayer,
    scoresByPlayer,
    isOver,
    winner,
    submitThrowUI,
    undoLast,
    pendingFirstWin,
    continueAfterFirst,
    endNow,
    isContinuing,

    // Sets/Legs exposés par le hook
    currentSet,
    currentLegInSet,
  } = useX01Engine({
    profiles,
    playerIds: effectivePlayerIds,
    start: startScore,
    doubleOut: outM !== "simple",
    onFinish: (m: MatchRecord) => {
      if (overlayOpen || pendingFinish) setPendingFinish(m);
      else onFinish(m);
    },
    resume: resumeSnapshot,
    finishPolicy: defaultFinishPolicy,
    setsToWin: setsTarget,
    legsPerSet: legsTarget,
    outMode: outM,
    inMode: inM,

    // ====== (B) onLegEnd branché sur StatsBridge ======
    onLegEnd: async (res: LegResult) => {
      // (facultatif) statsOnce
      StatsOnce.commitX01Leg?.({
        matchId: matchIdRef.current,
        profiles,
        leg: res as any,
        winnerId: res.winnerId ?? null,
        startScore,
      });

      // Source de visites pour StatsBridge (Visit[])
      const visits: Visit[] = (visitsLog || []).map((v) => ({
        p: v.p,
        segments: (v.segments || []).map((s) => ({ v: Number(s.v || 0), mult: (Number(s.mult || 1) as 1 | 2 | 3) })),
        bust: !!v.bust,
        score: Number(v.score || 0),
        ts: v.ts || Date.now(),
        // @ts-ignore pass-through
        isCheckout: (v as any).isCheckout,
        // @ts-ignore
        remainingAfter: (v as any).remainingAfter,
      }));

      // Joueurs (PlayerLite[]) — ✅ helper anti-typo
      const players: PlayerLite[] = mapEnginePlayersToLite(
        (state.players || []) as EnginePlayer[],
        profiles
      );

      const winnerId = res.winnerId ?? null;

      // 1) Leg & legacy pour overlay
      const { leg, legacy } = StatsBridge.makeLeg(visits, players, winnerId);

      // 2) Overlay fin de manche (legacy + leg)
      setLastLegResult({ ...legacy, winnerId, __legStats: leg });
      setOverlayOpen(true);

      // 3) Commit agrégats globaux profils
      try {
        await StatsBridge.commitLegAndAccumulate(leg, legacy);
      } catch (e) {
        console.warn("[StatsBridge.commitLegAndAccumulate] failed:", e);
      }

      // 4) Empiler le leg pour le match
      matchLegsRef.current.push(leg);

      // 5) Historique “leg” optionnel
      try {
        const id = crypto.randomUUID?.() ?? String(Date.now());
        History.upsert({
          id,
          kind: "leg",
          status: "finished",
          players,
          winnerId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          summary: {
            legs: 1,
            darts: Object.fromEntries(Object.keys(legacy.darts || {}).map((k) => [k, legacy.darts[k] || 0])),
            avg3ByPlayer: Object.fromEntries(Object.keys(legacy.avg3 || {}).map((k) => [k, legacy.avg3[k] || 0])),
            co: Object.values(legacy.coHits || {}).reduce((s, n) => s + (n || 0), 0),
          },
          payload: { leg, legacy },
        } as any);
        await History.list(); // hydrate sync cache
      } catch (e) {
        console.warn("[history] upsert leg failed:", e);
      }

      // 6) Reset compteurs/log
      visitNoRef.current = 0;
      setVisitsLog([]);
      setMissByPlayer({});
      setBustByPlayer({});
      setDBullByPlayer({});
    },
  });

  // Historique id
  const historyIdRef = React.useRef<string | undefined>(resumeId);
  const matchIdRef = React.useRef<string>(resumeId ?? (crypto.randomUUID?.() ?? String(Date.now())));

  // ----- Statistiques live pour l’affichage
  const [lastByPlayer, setLastByPlayer] = React.useState<Record<string, UIDart[]>>({});
  const [lastBustByPlayer, setLastBustByPlayer] = React.useState<Record<string, boolean>>({});
  const [dartsCount, setDartsCount] = React.useState<Record<string, number>>({});
  const [pointsSum, setPointsSum] = React.useState<Record<string, number>>({});
  const [visitsCount, setVisitsCount] = React.useState<Record<string, number>>({});
  const [bestVisitByPlayer, setBestVisitByPlayer] = React.useState<Record<string, number>>({});
  const [missByPlayer, setMissByPlayer] = React.useState<Record<string, number>>({});
  const [bustByPlayer, setBustByPlayer] = React.useState<Record<string, number>>({});
  const [dbullByPlayer, setDBullByPlayer] = React.useState<Record<string, number>>({});
  const [hitsByPlayer, setHitsByPlayer] = React.useState<
    Record<string, { h60: number; h100: number; h140: number; h180: number }>
  >({});
  const [impactByPlayer, setImpactByPlayer] = React.useState<
    Record<string, { doubles: number; triples: number; bulls: number }>
  >({});

  type Bucket = { inner: number; outer: number; double: number; triple: number; miss: number };
  const [perPlayerBuckets, setPerPlayerBuckets] =
    React.useState<Record<string, Record<string, Bucket>>>({});

  // SFX
  const dartHit = React.useMemo(
    () => createAudio(["/sounds/dart-hit.mp3", "/sounds/dart-hit.ogg"]),
    []
  );
  const bustSnd = React.useMemo(() => createAudio(["/sounds/bust.mp3", "/sounds/bust.ogg"]), []);
  const voiceOn = React.useMemo<boolean>(
    () => (safeGetLocalStorage("opt_voice") ?? "true") === "true",
    []
  );

  function playDartSfx(d: UIDart, nextThrow: UIDart[]) {
    const visitSum = nextThrow.reduce((s, x) => s + dartValue(x), 0);
    if (nextThrow.length === 3 && visitSum === 180) {
      playSound("180");
      return;
    }
    if (d.v === 25 && d.mult === 2) return playSound("doublebull");
    if (d.v === 25 && d.mult === 1) return playSound("bull");
    if (d.mult === 3) return playSound("triple");
    if (d.mult === 2) return playSound("double");
    playSound("dart-hit");
  }

  const profileById = React.useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of profiles) map[p.id] = p;
    return map;
  }, [profiles]);

  const [currentThrow, setCurrentThrow] = React.useState<UIDart[]>([]);
  const [multiplier, setMultiplier] = React.useState<1 | 2 | 3>(1);
  const [playersOpen, setPlayersOpen] = React.useState(true);

  const currentRemaining =
    scoresByPlayer[(currentPlayer?.id as string) || ""] ?? startScore;
  const volleyTotal = currentThrow.reduce((s, d) => s + dartValue(d), 0);

  function handleNumber(n: number) {
    if (currentThrow.length >= 3) return;
    const d: UIDart = { v: n, mult: n === 0 ? 1 : multiplier };
    const next = [...currentThrow, d];
    playDartSfx(d, next);
    try {
      (dartHit as any).currentTime = 0;
      (dartHit as any).play?.();
    } catch {}
    (navigator as any).vibrate?.(25);
    setCurrentThrow(next);
    setMultiplier(1);
  }
  function handleBull() {
    if (currentThrow.length >= 3) return;
    const d: UIDart = { v: 25, mult: multiplier === 2 ? 2 : 1 };
    const next = [...currentThrow, d];
    playDartSfx(d, next);
    try {
      (dartHit as any).currentTime = 0;
      (dartHit as any).play?.();
    } catch {}
    (navigator as any).vibrate?.(25);
    setCurrentThrow(next);
    setMultiplier(1);
  }

  // ----- Validation d’une volée
  function validateThrow() {
    if (!currentThrow.length || !currentPlayer) return;

    const currentRemainingLocal = scoresByPlayer[currentPlayer.id] ?? startScore;
    const volleyPts = currentThrow.reduce((s, d) => s + dartValue(d), 0);
    const after = currentRemainingLocal - volleyPts;

    let willBust = after < 0;
    const needDoubleOut = outM !== "simple";
    if (!willBust && needDoubleOut && after === 0) willBust = !isDoubleFinish(currentThrow);

    const ptsForStats = willBust ? 0 : volleyPts;

    // --- Comptage MISS / DBULL / BUST --- //
    const missCount = currentThrow.reduce((n, d) => n + (d.v === 0 ? 1 : 0), 0);
    const dbullCount = currentThrow.reduce((n, d) => n + (d.v === 25 && d.mult === 2 ? 1 : 0), 0);
    const isBust = willBust;

    if (missCount > 0) {
      setMissByPlayer((m) => ({ ...m, [currentPlayer.id]: (m[currentPlayer.id] || 0) + missCount }));
    }
    if (dbullCount > 0) {
      setDBullByPlayer((m) => ({ ...m, [currentPlayer.id]: (m[currentPlayer.id] || 0) + dbullCount }));
    }
    if (isBust) {
      setBustByPlayer((m) => ({ ...m, [currentPlayer.id]: (m[currentPlayer.id] || 0) + 1 }));
    }

    // Log visite (✅ darts inclus)
    {
      const isCheckout = !willBust && after === 0;
      pushVisitLog({
        playerId: currentPlayer.id,
        score: ptsForStats,
        remainingAfter: Math.max(after, 0),
        bust: willBust,
        isCheckout, // ✅ hit réel seulement si after==0
        dartsUsed: isCheckout ? currentThrow.length : 3,
        darts: currentThrow,
      });
    }

    // Stats live simples (affichage)
    setDartsCount((m) => ({
      ...m,
      [currentPlayer.id]: (m[currentPlayer.id] || 0) + currentThrow.length,
    }));
    setPointsSum((m) => ({
      ...m,
      [currentPlayer.id]: (m[currentPlayer.id] || 0) + ptsForStats,
    }));
    setVisitsCount((m) => ({
      ...m,
      [currentPlayer.id]: (m[currentPlayer.id] || 0) + 1,
    }));
    setBestVisitByPlayer((m) => ({
      ...m,
      [currentPlayer.id]: Math.max(m[currentPlayer.id] || 0, volleyPts),
    }));
    setHitsByPlayer((m) => {
      const prev = m[currentPlayer.id] || { h60: 0, h100: 0, h140: 0, h180: 0 };
      const add = { ...prev };
      if (volleyPts >= 60) add.h60++;
      if (volleyPts >= 100) add.h100++;
      if (volleyPts >= 140) add.h140++;
      if (volleyPts === 180) add.h180++;
      return { ...m, [currentPlayer.id]: add };
    });
    setImpactByPlayer((m) => {
      const add = m[currentPlayer.id] || { doubles: 0, triples: 0, bulls: 0 };
      for (const d of currentThrow) {
        if (d.v === 25) add.bulls += d.mult === 2 ? 1 : 0.5;
        if (d.mult === 2) add.doubles++;
        if (d.mult === 3) add.triples++;
      }
      return { ...m, [currentPlayer.id]: add };
    });

    persistAfterThrow(currentThrow);
    submitThrowUI(currentThrow);

    setLastByPlayer((m) => ({ ...m, [currentPlayer.id]: currentThrow }));
    setLastBustByPlayer((m) => ({ ...m, [currentPlayer.id]: !!willBust }));

    if (willBust) {
      try {
        (bustSnd as any).currentTime = 0;
        (bustSnd as any).play?.();
      } catch {}
      (navigator as any).vibrate?.([120, 60, 140]);
    } else {
      const voice = voiceOn && "speechSynthesis" in window;
      if (voice) {
        const u = new SpeechSynthesisUtterance(`${currentPlayer.name || ""}, ${volleyPts} points`);
        u.rate = 1;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    }

    setCurrentThrow([]);
    setMultiplier(1);
  }

  function handleBackspace() {
    playSound("dart-hit");
    setCurrentThrow((t) => t.slice(0, -1));
  }
  function handleCancel() {
    playSound("bust");
    if (currentThrow.length) setCurrentThrow((t) => t.slice(0, -1));
    else undoLast?.();
  }

  const liveRanking = React.useMemo<RankItem[]>(() => {
    const items: RankItem[] = ((state.players || []) as EnginePlayer[]).map((p) => ({
      id: p.id,
      name: p.name,
      score: scoresByPlayer[p.id] ?? startScore,
    }));
    items.sort((a, b) => {
      const az = a.score === 0, bz = b.score === 0;
      if (az && !bz) return -1;
      if (!az && bz) return 1;
      return a.score - b.score;
    });
    return items;
  }, [state.players, scoresByPlayer, startScore]);

  const goldBtn: React.CSSProperties = {
    borderRadius: 10,
    padding: "6px 12px",
    border: "1px solid rgba(255,180,0,.3)",
    background: "linear-gradient(180deg, #ffc63a, #ffaf00)",
    color: "#1a1a1a",
    fontWeight: 900,
    boxShadow: "0 10px 22px rgba(255,170,0,.28)",
    cursor: "pointer",
  };

  const flushPendingFinish = React.useCallback(() => {
    if (pendingFinish) {
      const m: MatchRecord = pendingFinish;
      setPendingFinish(null);
      setOverlayOpen(false);
      onFinish(m);
      return;
    }
    const rec: MatchRecord = makeX01RecordFromEngineCompat({
      engine: buildEngineLike([], winner?.id ?? null),
      existingId: historyIdRef.current,
    });
    History.upsert(rec);
    historyIdRef.current = rec.id;
    onFinish(rec);
  }, [pendingFinish, onFinish, winner?.id]);

  if (!state.players?.length) {
    return (
      <div style={{ padding: 16, maxWidth: CONTENT_MAX, margin: "0 auto" }}>
        <button
          onClick={() => (pendingFinish ? flushPendingFinish() : onExit())}
          style={goldBtn}
        >
          ← Quitter
        </button>
        <p>Aucun joueur sélectionné. Reviens au lobby.</p>
      </div>
    );
  }

  const currentAvatar =
    (currentPlayer && (profileById[currentPlayer.id]?.avatarDataUrl as string | null)) ?? null;

  const curDarts = currentPlayer ? (dartsCount[currentPlayer.id] || 0) : 0;
  const curPts = currentPlayer ? (pointsSum[currentPlayer.id] || 0) : 0;
  const curM3D = curDarts > 0 ? ((curPts / curDarts) * 3).toFixed(2) : "0.00";
  const dartsLeft = (3 - currentThrow.length) as 1 | 2 | 3;

  // ===== (C) Fin de match : faire le résumé via StatsBridge.makeMatch
  const prevIsOver = React.useRef(false);
  React.useEffect(() => {
    const justFinished = !prevIsOver.current && isOver;
    prevIsOver.current = isOver;

    if (justFinished) {
      // Persistance "in_progress/finished" minimale
      persistOnFinish();

      (async () => {
        try {
          // (C) Résumé de match unifié
          const playersArr: PlayerLite[] = mapEnginePlayersToLite(
            (state.players || []) as EnginePlayer[],
            profiles
          );

          const matchId = matchIdRef.current;
          const kind = "x01";
          const summary = StatsBridge.makeMatch(matchLegsRef.current, playersArr, matchId, kind);

          // Écran de fin (passe summary + legs)
          openEndOfMatchOverlay(summary, { legs: matchLegsRef.current });

          // Sauvegarde & agrégat global (profils)
          StatsBridge.commitMatchAndSave(summary, {
            legs: matchLegsRef.current,
            options: {
              startScore,
              outMode: outM,
              inMode: inM,
              setsToWin: setsTarget,
              legsPerSet: legsTarget,
            },
          });

          // ---------- B) Appel d’upsert sûr côté X01Play (match) ----------
          // On fabrique un petit résumé stable + payload "lourd"
          const per = matchLegsRef.current.flatMap((l: any) => l.perPlayer || []);
          const dartsTotal = per.reduce((n: number, p: any) => n + (p.darts || 0), 0);
          const avg3ByPlayer: Record<string, number> = Object.fromEntries(
            playersArr.map((pl) => {
              const perP = per.filter((x: any) => x.playerId === pl.id);
              const pts = perP.reduce((s: number, x: any) => s + (x.points || 0), 0);
              const d  = perP.reduce((s: number, x: any) => s + (x.darts  || 0), 0);
              const a3 = d > 0 ? (pts / d) * 3 : 0;
              return [pl.id, Math.round(a3 * 100) / 100];
            })
          );
          const co = matchLegsRef.current.filter((l: any) => !!l.winnerId).length;

          // Visites à persister (structure Visit)
          const visitsForPersist: Visit[] = (visitsLog || []).map((v) => ({
            p: v.p,
            segments: (v.segments || []).map((s) => ({ v: Number(s.v || 0), mult: (Number(s.mult || 1) as 1 | 2 | 3) })),
            bust: !!v.bust,
            score: Number(v.score || 0),
            ts: v.ts || Date.now(),
            // @ts-ignore pass-through
            isCheckout: (v as any).isCheckout,
            // @ts-ignore
            remainingAfter: (v as any).remainingAfter,
          }));

          await safeSaveMatch({
            id: matchId || crypto.randomUUID(),
            players: playersArr,
            winnerId: summary.winnerId ?? null,
            summary: {
              legs: matchLegsRef.current.length,
              darts: dartsTotal,
              avg3ByPlayer,
              co,
            },
            payload: {
              visits: visitsForPersist || [],
              legs: matchLegsRef.current || [],
              meta: { currentSet, currentLeg: currentLegInSet, legsTarget },
            },
          });

// === ÉCRIRE l’agrégat joueurs dans IndexedDB + mini-cache ===
// On reconstruit un delta simple par joueur (darts, points, bestVisit, bestCheckout)
try {
  const per: Record<string, { darts: number; points: number; bestVisit?: number; bestCheckout?: number }> = {};
  for (const leg of matchLegsRef.current || []) {
    const arr = (leg?.perPlayer || []) as Array<any>;
    for (const pp of arr) {
      const pid = pp.playerId;
      if (!per[pid]) per[pid] = { darts: 0, points: 0, bestVisit: 0, bestCheckout: 0 };
      per[pid].darts += Number(pp.darts || 0);
      per[pid].points += Number(pp.points || 0);
      per[pid].bestVisit = Math.max(per[pid].bestVisit || 0, Number(pp.bestVisit || 0));
      per[pid].bestCheckout = Math.max(per[pid].bestCheckout || 0, Number(pp.bestCheckout || 0));
    }
  }
  await addMatchSummary({
    winnerId: (winner?.id ?? null) || (summary?.winnerId ?? null),
    perPlayer: per,
  });
} catch (e) {
  console.warn("[statsLiteIDB:addMatchSummary] failed:", e);
}

          // ---------------------------------------------------------------

          // ===== [STATS LITE] push agrégats légers → IndexedDB =====
          try {
            const perPlayer: Record<string, { darts: number; points: number; bestVisit?: number; bestCheckout?: number }> = {};
            (state.players || []).forEach((p: any) => {
              const pid = p.id;
              perPlayer[pid] = {
                darts: (dartsCount?.[pid] || 0),
                points: (pointsSum?.[pid] || 0),
                bestVisit: (bestVisitByPlayer?.[pid] || 0),
                bestCheckout: 0,
              };
            });
            addLiteSummary({
              winnerId: summary.winnerId ?? (winner?.id ?? null),
              perPlayer,
            });
          } catch (e) {
            console.warn("[statsLiteIDB] addMatchSummary failed:", e);
          }
          // ==========================================================

          // Compat interne : on garde aussi ton commit résumé joueur + stats persistées locales
          try {
            commitMatchSummary(
              buildX01Summary({
                kind: "x01",
                winnerId: summary.winnerId ?? null,
                perPlayer: summary.perPlayer?.map((pp: any) => ({
                  playerId: pp.playerId,
                  name: playersArr.find((p) => p.id === pp.playerId)?.name || "",
                  avg3: Number(pp.avg3 || 0),
                  bestVisit: Number(pp.bestVisit || 0),
                  bestCheckout: Number(pp.bestCheckout || 0),
                  darts: Number(pp.darts || 0),
                  win: !!pp.win,
                  buckets: pp.buckets || undefined,
                })),
              })
            );
          } catch (e) {
            console.warn("[commitMatchSummary] compat failed:", e);
          }

          // Compat encore: saveMatchStats (ancien pipeline)
          try {
            const winnerIdNow = summary.winnerId ?? (winner?.id ?? playersArr[0]?.id);
            const m = aggregateMatch(matchLegsRef.current as any, playersArr.map((p) => p.id));
            saveMatchStats({
              id: crypto.randomUUID?.() ?? String(Date.now()),
              createdAt: Date.now(),
              rules: {
                x01Start: startScore,
                finishPolicy: outM !== "simple" ? "doubleOut" : "singleOut",
                setsToWin: setsTarget,
                legsPerSet: legsTarget,
              },
              players: playersArr.map((p) => p.id),
              winnerId: winnerIdNow,
              computed: m,
            } as any);
          } catch (e) {
            console.warn("aggregateMatch/saveMatchStats:", e);
          }
        } catch (e) {
          console.warn("[StatsBridge.makeMatch] failed:", e);
        }
      })();
    }

    // TTS victoire
    const voice = (safeGetLocalStorage("opt_voice") ?? "true") === "true";
    if (!justFinished || !voice || !("speechSynthesis" in window)) return;
    const ords = ["", "Deuxième", "Troisième", "Quatrième", "Cinquième", "Sixième", "Septième", "Huitième"];
    const ordered = [...liveRanking].sort((a, b) => {
      const az = a.score === 0,
        bz = b.score === 0;
      if (az && !bz) return -1;
      if (!az && bz) return 1;
      return a.score - b.score;
    });
    const parts: string[] = [];
    if (ordered[0]) parts.push(`Victoire ${ordered[0].name}`);
    for (let i = 1; i < ordered.length && i < 8; i++) parts.push(`${ords[i]} ${ordered[i].name}`);
    const text = parts.join(". ") + ".";
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, [
    isOver,
    liveRanking,
    winner?.id,
    state.players,
    scoresByPlayer,
    startScore,
    setsTarget,
    legsTarget,
    outM,
    inM,
    profiles,
  ]);

  const showEndBanner = isOver && !pendingFirstWin && !isContinuing;

  // Musique fond overlay / fin
  const [bgMusic] = React.useState(() => new Audio("/sounds/victory.mp3"));
  React.useEffect(() => {
    if (overlayOpen || showEndBanner) {
      try {
        bgMusic.loop = true;
        (bgMusic as any).volume = 0.6;
        (bgMusic as any).currentTime = 0;
        (bgMusic as any).play?.().catch(() => {});
      } catch {}
    } else {
      try {
        (bgMusic as any).pause?.();
        (bgMusic as any).currentTime = 0;
      } catch {}
    }
  }, [overlayOpen, showEndBanner, bgMusic]);

  // ===== Fallback lastLegResult si jamais overlay ouvert sans données ====
  React.useEffect(() => {
    if (!isOver) return;
    if (!overlayOpen) setOverlayOpen(true);
    if (!lastLegResult) {
      const playersArr = ((state.players || []) as { id: string; name: string }[]);
      const remaining: Record<string, number> = {};
      const darts: Record<string, number> = {};
      const visits: Record<string, number> = {};
      const avg3: Record<string, number> = {};
      const bestVisit: Record<string, number> = {};
      const bestCheckout: Record<string, number> = {};
      const h60: Record<string, number> = {};
      const h100: Record<string, number> = {};
      const h140: Record<string, number> = {};
      const h180: Record<string, number> = {};

      const miss: Record<string, number> = {};
      const bust: Record<string, number> = {};
      const dbull: Record<string, number> = {};
      const missPct: Record<string, number> = {};
      const bustPct: Record<string, number> = {};
      const dbullPct: Record<string, number> = {};

      const doubles: Record<string, number> = {};
      const triples: Record<string, number> = {};
      const bulls: Record<string, number> = {};

      for (const p of playersArr) {
        const pid = p.id;
        const dCount = dartsCount[pid] || 0;
        const pSum = pointsSum[pid] || 0;
        const a3d = dCount > 0 ? (pSum / dCount) * 3 : 0;

        remaining[pid] = scoresByPlayer[pid] ?? startScore;
        darts[pid] = dCount;
        visits[pid] = visitsCount[pid] || (dCount ? Math.ceil(dCount / 3) : 0);
        avg3[pid] = Math.round(a3d * 100) / 100;
        bestVisit[pid] = bestVisitByPlayer[pid] || 0;
        bestCheckout[pid] = 0;
        h60[pid] = hitsByPlayer[pid]?.h60 || 0;
        h100[pid] = hitsByPlayer[pid]?.h100 || 0;
        h140[pid] = hitsByPlayer[pid]?.h140 || 0;
        h180[pid] = hitsByPlayer[pid]?.h180 || 0;

        miss[pid] = missByPlayer[pid] || 0;
        bust[pid] = bustByPlayer[pid] || 0;
        dbull[pid] = dbullByPlayer[pid] || 0;
        missPct[pid] = pct(miss[pid], dCount);
        bustPct[pid] = pct(bust[pid], visits[pid]); // bust = par volée
        dbullPct[pid] = pct(dbull[pid], dCount);

        doubles[pid] = impactByPlayer[pid]?.doubles || 0;
        triples[pid] = impactByPlayer[pid]?.triples || 0;
        bulls[pid] = impactByPlayer[pid]?.bulls || 0;
      }

      const order = [...playersArr]
        .sort((a, b) => {
          const as = remaining[a.id] ?? startScore;
          const bs = remaining[b.id] ?? startScore;
          if (as === 0 && bs !== 0) return -1;
          if (as !== 0 && bs === 0) return 1;
          if (as !== bs) return as - bs;
          return (avg3[b.id] ?? 0) - (avg3[a.id] ?? 0);
        })
        .map((p) => p.id);

      setLastLegResult({
        legNo: 1,
        winnerId: order[0] || playersArr[0]?.id || "",
        order,
        finishedAt: Date.now(),
        remaining,
        darts,
        visits,
        avg3,
        bestVisit,
        bestCheckout,
        h60,
        h100,
        h140,
        h180,
        miss,
        misses: miss,
        missPct,
        bust,
        busts: bust,
        bustPct,
        dbull,
        dbulls: dbull,
        dbullPct,
        doubles,
        triples,
        bulls,
      } as LegResult);
    }
  }, [isOver, overlayOpen, lastLegResult, state.players, scoresByPlayer, startScore, dartsCount, pointsSum, visitsCount, bestVisitByPlayer, hitsByPlayer, missByPlayer, bustByPlayer, dbullByPlayer, impactByPlayer]);

  // Persistance “en cours”
  function buildEngineLike(dartsThisTurn: UIDart[], winnerId?: string | null) {
    const playersArr: EnginePlayer[] = ((state.players || []) as EnginePlayer[]).map((p) => ({
      id: p.id,
      name: p.name,
    }));
    const scores: number[] = playersArr.map((p) => scoresByPlayer[p.id] ?? startScore);
    const idx = playersArr.findIndex((p) => p.id === (currentPlayer?.id as string));
    return {
      rules: {
        start: startScore,
        doubleOut: outM !== "simple",
        setsToWin: setsTarget,
        legsPerSet: legsTarget,
        outMode: outM,
        inMode: inM,
      },
      players: playersArr,
      scores,
      currentIndex: idx >= 0 ? idx : 0,
      dartsThisTurn,
      winnerId: winnerId ?? null,
    };
  }
  function persistAfterThrow(dartsJustThrown: UIDart[]) {
    const rec: MatchRecord = makeX01RecordFromEngineCompat({
      engine: buildEngineLike(dartsJustThrown, null),
      existingId: historyIdRef.current,
    });
    History.upsert(rec);
    historyIdRef.current = rec.id;
  }
  function persistOnFinish() {
    const rec: MatchRecord = makeX01RecordFromEngineCompat({
      engine: buildEngineLike([], winner?.id ?? null),
      existingId: historyIdRef.current,
    });
    History.upsert(rec);
    historyIdRef.current = rec.id;
  }

  /* ===== Mesure du header ===== */
  const headerWrapRef = React.useRef<HTMLDivElement | null>(null);
  const [headerH, setHeaderH] = React.useState<number>(0);
  React.useEffect(() => {
    const el = headerWrapRef.current;
    if (!el) return;
    const measure = () => setHeaderH(Math.ceil(el.getBoundingClientRect().height));
    measure();
    const ro = (window as any).ResizeObserver ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect?.();
      window.removeEventListener("resize", measure);
    };
  }, []);

  /* ===== Layout fixe (header/top + zone joueurs scroll + keypad fixe) ===== */
  return (
    <div className="x01play-container" style={{ overflow: "hidden" }}>
      {/* ===== TOP FIXE : barre haute + header ===== */}
      <div
        ref={headerWrapRef}
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          top: 0,
          zIndex: 60,
          width: `min(100%, ${CONTENT_MAX}px)`,
          paddingInline: 12,
          paddingTop: 6,
          paddingBottom: 6,
          background: "transparent",
        }}
      >
        {/* Barre haute */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <button onClick={() => (pendingFinish ? flushPendingFinish() : onExit())} style={goldBtn}>← Quitter</button>
          {/* ✅ Set/Leg UNIQUEMENT ici */}
          <SetLegChip currentSet={currentSet} currentLegInSet={currentLegInSet} setsTarget={setsTarget} legsTarget={legsTarget} />
        </div>

        {/* HEADER */}
        <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", paddingInline: 0 }}>
          <HeaderBlock
            currentPlayer={currentPlayer as any}
            currentAvatar={(currentPlayer && profileById[currentPlayer.id]?.avatarDataUrl) || null}
            currentRemaining={currentRemaining}
            currentThrow={currentThrow}
            doubleOut={outM !== "simple"}
            multiplier={multiplier}
            setMultiplier={setMultiplier}
            start={startScore}
            scoresByPlayer={scoresByPlayer}
            statePlayers={(state.players || []) as EnginePlayer[]}
            liveRanking={liveRanking}
            curDarts={curDarts}
            curM3D={curM3D}
            bestVisit={bestVisitByPlayer[currentPlayer?.id ?? ""] ?? 0}
            currentSet={currentSet}
            currentLegInSet={currentLegInSet}
            setsTarget={setsTarget}
            legsTarget={legsTarget}
          />
        </div>
      </div>

      {/* ===== ZONE JOUEURS ===== */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          top: Math.max((headerH || 0) - 6, 0),
          bottom: NAV_HEIGHT + Math.round(KEYPAD_HEIGHT * KEYPAD_SCALE) + 8,
          zIndex: 40,
          width: `min(100%, ${CONTENT_MAX}px)`,
          paddingInline: 12,
          overflow: "auto",
        }}
      >
        <PlayersBlock
          playersOpen={playersOpen}
          setPlayersOpen={setPlayersOpen}
          statePlayers={(state.players || []) as EnginePlayer[]}
          profileById={profileById}
          lastByPlayer={lastByPlayer}
          lastBustByPlayer={lastBustByPlayer}
          dartsCount={dartsCount}
          pointsSum={pointsSum}
          start={startScore}
          scoresByPlayer={scoresByPlayer}
          currentSet={currentSet}
          currentLegInSet={currentLegInSet}
          setsTarget={setsTarget}
          legsTarget={legsTarget}
          /* Ajouts pour checkout dans l’entête joueurs */
          currentPlayer={currentPlayer as any}
          currentThrow={currentThrow}
          outMode={outM}
        />
      </div>

      {/* ===== KEYPAD FIXE ===== */}
      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: `translateX(-50%) scale(${KEYPAD_SCALE})`,
          bottom: NAV_HEIGHT,
          zIndex: 45,
          padding: "0 12px 8px",
          width: `min(100%, ${CONTENT_MAX}px)`,
        }}
      >
        <Keypad
          currentThrow={currentThrow}
          multiplier={multiplier}
          onSimple={() => setMultiplier(1)}
          onDouble={() => setMultiplier(2)}
          onTriple={() => setMultiplier(3)}
          onBackspace={handleBackspace}
          onCancel={handleCancel}
          onNumber={handleNumber}
          onBull={handleBull}
          onValidate={validateThrow}
          hidePreview
        />
      </div>

      {/* Modale CONTINUER ? — local */}
      {pendingFirstWin && (
        // @ts-ignore
        <ContinueModal endNow={endNow} continueAfterFirst={continueAfterFirst} />
      )}

      {/* Overlay fin de manche — forcé au-dessus de tout */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: overlayOpen ? "auto" : "none" }}>
        <EndOfLegOverlay
          open={overlayOpen}
          result={lastLegResult as any}
          playersById={React.useMemo(
            () =>
              Object.fromEntries(
                ((state.players || []) as EnginePlayer[]).map((p) => {
                  const prof = profileById[p.id];
                  return [
                    p.id,
                    { id: p.id, name: p.name, avatarDataUrl: (prof as any)?.avatarDataUrl },
                  ];
                })
              ),
            [state.players, profileById]
          )}
          onClose={() => setOverlayOpen(false)}
          onReplay={() => setOverlayOpen(false)}
          onSave={(res) => {
            try {
              // ✅ helper anti-typo
              const playersNow: PlayerLite[] = mapEnginePlayersToLite(
                (state.players || []) as EnginePlayer[],
                profiles
              );
              History.upsert({
                kind: "leg",
                id: crypto.randomUUID?.() ?? String(Date.now()),
                status: "finished",
                players: playersNow,
                updatedAt: Date.now(),
                createdAt: Date.now(),
                payload: { ...res, meta: { currentSet, currentLegInSet, setsTarget, legsTarget } },
              } as any);
              History.list(); // hydrate
              (navigator as any).vibrate?.(50);
            } catch (e) {
              console.warn("Impossible de sauvegarder la manche:", e);
            }
            setOverlayOpen(false);
          }}
        />
      </div>

      {/* Bandeau fin de partie */}
      {isOver && !pendingFirstWin && !isContinuing && (
        <EndBanner
          winnerName={winner?.name || "—"}
          continueAfterFirst={continueAfterFirst}
          openOverlay={() => setOverlayOpen(true)}
          flushPendingFinish={flushPendingFinish}
          goldBtn={goldBtn}
        />
      )}
    </div>
  );

  /* ===== sous-composants internes ===== */

  function HeaderBlock(props: {
    currentPlayer?: EnginePlayer | null;
    currentAvatar: string | null;
    currentRemaining: number;
    currentThrow: UIDart[];
    doubleOut: boolean;
    multiplier: 1 | 2 | 3;
    setMultiplier: (m: 1 | 2 | 3) => void;
    start: number;
    scoresByPlayer: Record<string, number>;
    statePlayers: EnginePlayer[];
    liveRanking: RankItem[];
    curDarts: number;
    curM3D: string;
    bestVisit: number;
    currentSet: number;
    currentLegInSet: number;
    setsTarget: number;
    legsTarget: number;
  }) {
    const {
      currentPlayer,
      currentAvatar,
      currentRemaining,
      currentThrow,
      doubleOut,
      liveRanking,
      curDarts,
      curM3D,
      bestVisit,
    } = props;

    return (
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          transform: "none",
          transformOrigin: "top center",
          background:
            "radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.10), transparent 55%), linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.8))",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 18,
          padding: Math.max(HEADER_OUTER_PADDING - 4, 6),
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: 10,
            alignItems: "center",
          }}
        >
          {/* Colonne gauche : Avatar + Nom + Mini-Stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              alignItems: "center",
            }}
          >
            <div
              style={{
                padding: 6,
                borderRadius: "50%",
                WebkitMaskImage:
                  "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                maskImage:
                  "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
              }}
            >
              <div
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "linear-gradient(180deg, #1b1b1f, #111114)",
                  boxShadow: "0 8px 28px rgba(0,0,0,.35)",
                }}
              >
                {currentAvatar ? (
                  <img
                    src={currentAvatar}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#999",
                      fontWeight: 700,
                    }}
                  >
                    ?
                  </div>
                )}
              </div>
            </div>

            <div style={{ fontWeight: 900, fontSize: 18, color: "#ffcf57", letterSpacing: 0.3 }}>
              {currentPlayer?.name ?? "—"}
            </div>

            <div style={{ ...miniCard, width: MINI_CARD_WIDTH, height: MINI_CARD_HEIGHT, padding: 8 }}>
              <div style={miniText}>
                <div>
                  Meilleure volée : <b>{Math.max(0, bestVisit)}</b>
                </div>
                <div>
                  Moy/3D : <b>{curM3D}</b>
                </div>
                <div>
                  Darts jouées : <b>{curDarts}</b>
                </div>
                <div>
                  Volée : <b>{Math.min(currentThrow.length, 3)}/3</b>
                </div>
              </div>
            </div>
          </div>

          {/* Centre : score + volée + checkout + mini-classement */}
          <div style={{ textAlign: "center", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                fontSize: 72,
                lineHeight: 1,
                fontWeight: 900,
                color: "#ffcf57",
                textShadow: "0 4px 20px rgba(255,195,26,.25)",
                letterSpacing: 0.5,
                marginTop: 2,
              }}
            >
              {Math.max(currentRemaining - currentThrow.reduce((s, d) => s + dartValue(d), 0), 0)}
            </div>

            {/* Pastilles volée */}
            <div style={{ marginTop: 2, display: "flex", gap: 6, justifyContent: "center" }}>
              {[0, 1, 2].map((i: number) => {
                const d = currentThrow[i];
                const afterNow =
                  currentRemaining - currentThrow.slice(0, i + 1).reduce((s, x) => s + dartValue(x), 0);
                const wouldBust =
                  afterNow < 0 ||
                  (props.doubleOut && afterNow === 0 && !isDoubleFinish(currentThrow.slice(0, i + 1)));
                const st = chipStyle(d, wouldBust);
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 44,
                      height: 32,
                      padding: "0 12px",
                      borderRadius: 10,
                      border: st.border as string,
                      background: st.background as string,
                      color: st.color as string,
                      fontWeight: 800,
                    }}
                  >
                    {fmt(d)}
                  </span>
                );
              })}
            </div>

            {/* Checkout (header) */}
            {(() => {
              const only = suggestCheckout(
                Math.max(currentRemaining - currentThrow.reduce((s, d) => s + dartValue(d), 0), 0),
                props.doubleOut,
                (3 - currentThrow.length) as 1 | 2 | 3
              )[0];
              if (!only || currentThrow.length >= 3) return null;
              return (
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 6,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,.08)",
                      background:
                        "radial-gradient(120% 120% at 50% 0%, rgba(255,195,26,.10), rgba(30,30,34,.95))",
                      minWidth: 180,
                      maxWidth: 520,
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,187,51,.4)",
                        background: "rgba(255,187,51,.12)",
                        color: "#ffc63a",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {only}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Mini-Classement */}
            <div style={{ ...miniCard, alignSelf: "center", width: "min(320px, 100%)", height: "auto", padding: 6 }}>
              <div style={{ maxHeight: 3 * 28, overflow: (liveRanking.length > 3 ? "auto" : "visible") as any }}>
                {liveRanking.map((r, i) => (
                  <div key={r.id} style={{ ...miniRankRow, marginBottom: 3 }}>
                    <div style={miniRankName}>
                      {i + 1}. {r.name}
                    </div>
                    <div style={r.score === 0 ? miniRankScoreFini : miniRankScore}>
                      {r.score === 0 ? "FINI" : r.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function PlayersBlock(props: {
    playersOpen: boolean;
    setPlayersOpen: (b: boolean) => void;
    statePlayers: EnginePlayer[];
    profileById: Record<string, Profile>;
    lastByPlayer: Record<string, UIDart[]>;
    lastBustByPlayer: Record<string, boolean>;
    dartsCount: Record<string, number>;
    pointsSum: Record<string, number>;
    start: number;
    scoresByPlayer: Record<string, number>;
    currentSet: number;
    currentLegInSet: number;
    setsTarget: number;
    legsTarget: number;
    // Ajouts pour checkout à droite de "JOUEURS"
    currentPlayer?: EnginePlayer | null;
    currentThrow: UIDart[];
    outMode: Mode;
  }) {
    const {
      playersOpen,
      setPlayersOpen,
      statePlayers,
      profileById,
      dartsCount,
      pointsSum,
      start,
      scoresByPlayer,
      currentPlayer,
      currentThrow,
      outMode,
    } = props;

    const currentRemainingHere =
      scoresByPlayer[(currentPlayer?.id as string) || ""] ?? start;

    return (
      <div
        style={{
          background: "linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.85))",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 18,
          padding: PLAYERS_BLOCK_PADDING,
          marginBottom: 10,
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        {/* ✅ En-tête compact : JOUEURS + checkout + disclosure (sans Set/Leg) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "4px 6px 6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "4px 8px",
                borderRadius: 8,
                background: "linear-gradient(180deg, #ffc63a, #ffaf00)",
                color: "#151517",
                fontWeight: 900,
                letterSpacing: 0.3,
                fontSize: 11.5,
              }}
            >
              JOUEURS
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(() => {
              const only = suggestCheckout(
                Math.max(
                  currentRemainingHere - currentThrow.reduce((s, d) => s + dartValue(d), 0),
                  0
                ),
                outMode !== "simple",
                (3 - currentThrow.length) as 1 | 2 | 3
              )[0];
            if (!only) return null;
              return (
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,187,51,.4)",
                    background: "rgba(255,187,51,.12)",
                    color: "#ffc63a",
                    fontWeight: 900,
                    whiteSpace: "nowrap",
                    fontSize: 11.5,
                  }}
                >
                  {only}
                </span>
              );
            })()}
            <button
              onClick={() => setPlayersOpen(!playersOpen)}
              aria-label="Afficher / masquer les joueurs"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.12)",
                background: "transparent",
                color: "#e8e8ec",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              {playersOpen ? "▴" : "▾"}
            </button>
          </div>
        </div>

        {playersOpen && (
          <div
            style={{
              marginTop: 4,
              maxHeight: `${PLAYERS_LIST_MAX_H_VH}vh`,
              overflow: "auto",
              paddingRight: 4,
            }}
          >
            {statePlayers.map((p) => {
              const prof = profileById[p.id];
              const avatarSrc = (prof?.avatarDataUrl as string | null) ?? null;
              const dCount = dartsCount[p.id] || 0;
              const pSum = pointsSum[p.id] || 0;
              const a3d = dCount > 0 ? ((pSum / dCount) * 3).toFixed(2) : "0.00";

              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: PLAYER_ROW_GAP,
                    padding: `${PLAYER_ROW_PAD_Y}px 10px`,
                    borderRadius: 12,
                    background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
                    border: "1px solid rgba(255,255,255,.07)",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      width: PLAYER_ROW_AVATAR,
                      height: PLAYER_ROW_AVATAR,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "rgba(255,255,255,.06)",
                      flex: "0 0 auto",
                    }}
                  >
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#999",
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        ?
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Ligne prénom + pastilles "dernière volée" */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "#ffcf57" }}>{p.name}</div>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {renderLastVisitChips({ __visits: visitsLog, ...state }, p.id)}
                      </div>
                    </div>

                    {/* Détails compactés (sans Set/Leg) */}
                    <div style={{ marginTop: 3, fontSize: 11.5, color: "#cfd1d7" }}>
                      Darts: {dCount} • Moy/3D: {a3d}
                    </div>
                  </div>

                  <div
                    style={{
                      fontWeight: 900,
                      color: (scoresByPlayer[p.id] ?? start) === 0 ? "#7fe2a9" : "#ffcf57",
                    }}
                  >
                    {scoresByPlayer[p.id] ?? start}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function EndBanner({
    winnerName,
    continueAfterFirst,
    openOverlay,
    flushPendingFinish,
    goldBtn,
  }: {
    winnerName: string;
    continueAfterFirst: () => void;
    openOverlay: () => void;
    flushPendingFinish: () => void;
    goldBtn: React.CSSProperties;
  }) {
    return (
      <div
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: NAV_HEIGHT + Math.round(KEYPAD_HEIGHT * KEYPAD_SCALE) + 80,
          zIndex: 47,
          background: "linear-gradient(180deg, #ffc63a, #ffaf00)",
          color: "#1a1a1a",
          fontWeight: 900,
          textAlign: "center",
          padding: 12,
          borderRadius: 12,
          boxShadow: "0 10px 28px rgba(0,0,0,.35)",
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <span>Victoire : {winnerName}</span>
        <button onClick={continueAfterFirst} style={goldBtn}>
          Continuer (laisser finir)
        </button>
        <button onClick={openOverlay} style={goldBtn}>
          Classement
        </button>
        <button onClick={flushPendingFinish} style={goldBtn}>
          Terminer
        </button>
      </div>
    );
  }

  // ===== (C) Impl simple : envoie summary + legs au parent via onFinish (payload)
  function openEndOfMatchOverlay(summary: any, { legs }: { legs: any[] }) {
    try {
      const engineLike = buildEngineLike([], summary.winnerId ?? null);
      const rec: MatchRecord = {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        kind: "x01",
        status: "finished",
        players: (engineLike.players as any) || [],
        winnerId: summary.winnerId ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        payload: {
          summary,
          legs,
          state: engineLike,
        },
      } as any;

      // ⚠️ On NE ré-upsert plus le match ici (déjà fait via safeSaveMatch)
      onFinish(rec);
    } catch (e) {
      console.warn("openEndOfMatchOverlay failed:", e);
    }
  }
}

/* ===== Composant Set/Leg — utilisé UNIQUEMENT dans la barre du haut ===== */
function SetLegChip({
  currentSet,
  currentLegInSet,
  setsTarget,
  legsTarget,
}: {
  currentSet: number;
  currentLegInSet: number;
  setsTarget: number;
  legsTarget: number;
}) {
  const st: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,200,80,.35)",
    background: "linear-gradient(180deg, rgba(255,195,26,.12), rgba(30,30,34,.95))",
    color: "#ffcf57",
    fontWeight: 800,
    fontSize: 12,
    boxShadow: "0 6px 18px rgba(255,195,26,.15)",
    whiteSpace: "nowrap",
  };
  return (
    <span style={st}>
      <span>Set {currentSet}/{setsTarget}</span>
      <span style={{ opacity: 0.6 }}>•</span>
      <span>Leg {currentLegInSet}/{legsTarget}</span>
    </span>
  );
}

/* ===== Styles mini-cards & ranking ===== */
const miniCard: React.CSSProperties = {
  width: "clamp(150px, 22vw, 190px)",
  height: 86,
  padding: 6,
  borderRadius: 12,
  background: "linear-gradient(180deg, rgba(22,22,26,.96), rgba(14,14,16,.98))",
  border: "1px solid rgba(255,255,255,.10)",
  boxShadow: "0 10px 22px rgba(0,0,0,.35)",
};
const miniText: React.CSSProperties = { fontSize: 12, color: "#d9dbe3", lineHeight: 1.25 };
const miniRankRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "3px 6px",
  borderRadius: 6,
  background: "rgba(255,255,255,.04)",
  marginBottom: 3,
  fontSize: 11,
  lineHeight: 1.15,
};
const miniRankName: React.CSSProperties = { fontWeight: 700, color: "#ffcf57" };
const miniRankScore: React.CSSProperties = { fontWeight: 800, color: "#ffcf57" };
const miniRankScoreFini: React.CSSProperties = { fontWeight: 800, color: "#7fe2a9" };

/* ===== ContinueModal (local) ===== */
function ContinueModal({
  endNow,
  continueAfterFirst,
}: {
  endNow: () => void;
  continueAfterFirst: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(440px, 92%)",
          borderRadius: 16,
          padding: 16,
          background:
            "linear-gradient(180deg, rgba(20,20,24,.96), rgba(14,14,16,.98))",
          border: "1px solid rgba(255,255,255,.12)",
          boxShadow: "0 18px 40px rgba(0,0,0,.45)",
          color: "#eee",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>
          Continuer la manche ?
        </div>
        <div style={{ opacity: 0.85, marginBottom: 14 }}>
          Un joueur a fini. Tu veux laisser les autres terminer leur leg ou
          arrêter maintenant ?
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={continueAfterFirst}
            style={{
              borderRadius: 10,
              padding: "8px 12px",
              border: "1px solid rgba(120,200,130,.35)",
              background: "linear-gradient(180deg,#3cc86d,#2aa85a)",
              color: "#101214",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Continuer
          </button>
          <button
            onClick={endNow}
            style={{
              borderRadius: 10,
              padding: "8px 12px",
              border: "1px solid rgba(255,180,0,.35)",
              background: "linear-gradient(180deg,#ffc63a,#ffaf00)",
              color: "#101214",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Terminer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Divers helpers ---------- */
function dartValue(d: UIDart): number {
  if (!d) return 0;
  if (d.v === 25 && d.mult === 2) return 50;
  return d.v * d.mult;
}
function isDoubleFinish(darts: UIDart[]): boolean {
  const last = darts[darts.length - 1];
  if (!last) return false;
  if (last.v === 25 && last.mult === 2) return true;
  return last.mult === 2;
}
function safeGetLocalStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function createAudio(urls: string[]) {
  const a = new Audio();
  const src =
    urls.find((u) => {
      const ext = u.split(".").pop() || "";
      const mime = ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : "";
      return !!a.canPlayType(mime);
    }) || urls[0];
  a.src = src;
  return a;
}
function makeX01RecordFromEngineCompat(args: {
  engine: {
    rules: {
      start: number;
      doubleOut: boolean;
      setsToWin?: number;
      legsPerSet?: number;
      outMode?: Mode;
      inMode?: Mode;
    };
    players: EnginePlayer[];
    scores: number[];
    currentIndex: number;
    dartsThisTurn: UIDart[];
    winnerId: string | null;
  };
  existingId?: string;
}): MatchRecord {
  const { engine, existingId } = args;
  const payload = {
    state: {
      rules: engine.rules,
      players: engine.players,
      scores: engine.scores,
      currentIndex: engine.currentIndex,
      dartsThisTurn: engine.dartsThisTurn,
      winnerId: engine.winnerId,
    },
    kind: "x01",
  };
  const now = Date.now();
  const rec: any = {
    id: existingId ?? (crypto.randomUUID?.() ?? String(now)),
    kind: "x01",
    status: engine.winnerId ? "finished" : "in_progress",
    players: engine.players,
    winnerId: engine.winnerId || null,
    createdAt: now,
    updatedAt: now,
    payload,
  };
  return rec as MatchRecord;
}

/* ====== PATCH (B) — Helper d’upsert sûr Historique (match) ====== */
async function safeSaveMatch({
  id,
  players,
  winnerId,
  summary,
  payload,
}: {
  id: string;
  players: { id: string; name?: string; avatarDataUrl?: string | null }[];
  winnerId: string | null;
  summary: { legs?: number; darts?: number; avg3ByPlayer?: Record<string, number>; co?: number } | null;
  payload: any;
}) {
  try {
    const now = Date.now();
    await History.upsert({
      id,
      kind: "x01",
      status: "finished",
      players,
      winnerId,
      createdAt: now,
      updatedAt: now,
      summary: summary || null,
      payload, // lourd → compressé par history.ts
    });
    await History.list(); // hydrate le cache synchro
    console.info("[HIST:OK]", id);
  } catch (e) {
    console.warn("[HIST:FAIL]", e);
  }
}
