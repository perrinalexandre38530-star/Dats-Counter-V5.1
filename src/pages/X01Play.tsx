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
// + Affichage Set/Leg — joueurs & header (depuis le hook)
// ❗️Paramétrage en amont (X01Setup) + lecture robuste (router/global)
// ============================================
import React from "react";
import { useX01Engine } from "../hooks/useX01Engine";
import Keypad from "../components/Keypad";
import EndOfLegOverlay from "../components/EndOfLegOverlay";
import { playSound } from "../lib/sound";

// Historique
import { History, type SavedMatch } from "../lib/history";

// Pont “stats unifiées”
import { mergeLegToBasics } from "../lib/statsBridge";

// Stats locales riches
import { commitLegStatsOnce } from "../lib/statsOnce";
import { saveMatchStats, computeLegStats, aggregateMatch } from "../lib/stats";
import type { Visit, LegInput, LegStats as RichLegStats } from "../lib/stats";

// Types app
import type {
  Profile,
  MatchRecord,
  Dart as UIDart,
  LegResult,
  FinishPolicy,
  X01Snapshot,
} from "../lib/types";

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
    finishPolicy: (fromParams.finishPolicy ??
      fromGlobal.finishPolicy ??
      ("firstToZero" as FinishPolicy)) as FinishPolicy,
    officialMatch: fromParams.officialMatch ?? fromGlobal.officialMatch ?? false,
    resume: (fromParams.resume ?? fromGlobal.resume ?? null) as X01Snapshot | null,
  };
  return merged;
}

/* ---------------------------------------------
   Helpers commit Fin de manche (compat Legacy/New)
----------------------------------------------*/
type LegacyLegResultLite = {
  legNo: number;
  winnerId: string | null;
  finishedAt: number;
  [k: string]: any;
};

function isNewLegStats(x: any): x is import("../lib/stats").LegStats {
  return !!x && typeof x === "object" && Array.isArray(x.players) && !!x.perPlayer;
}
function pickWinnerId(res: LegacyLegResultLite | import("../lib/stats").LegStats) {
  return isNewLegStats(res) ? (res.winnerId ?? null) : (res.winnerId ?? null);
}
function pickLegNo(res: LegacyLegResultLite | import("../lib/stats").LegStats) {
  return isNewLegStats(res) ? res.legNo : res.legNo;
}
async function commitFinishedLeg(opts: {
  result: LegacyLegResultLite | import("../lib/stats").LegStats;
  resumeId?: string | null;
  kind?: "x01" | "cricket" | string;
}) {
  const { result, resumeId, kind = "x01" } = opts;
  try { await mergeLegToBasics(result); } catch (e) { console.warn("[statsBridge] mergeLegToBasics failed:", e); }
  try {
    const id = resumeId || (crypto.randomUUID?.() ?? String(Date.now()));
    const winnerId = pickWinnerId(result);
    const legNo = pickLegNo(result);
    await History.upsert({
      id, kind, status: "finished", updatedAt: Date.now(), winnerId,
      summary: { legNo, winnerId }, payload: result,
    } as unknown as SavedMatch);
  } catch (e) { console.warn("[history] upsert failed:", e); }
}

/* ---------------------------------------------
   Helper local pour fabriquer un MatchRecord
----------------------------------------------*/
function makeX01RecordFromEngineCompat(args: {
  engine: {
    rules: { start: number; doubleOut: boolean; setsToWin?: number; legsPerSet?: number; outMode?: Mode; inMode?: Mode };
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

/* ---------- Helpers visuels ---------- */
function fmt(d?: UIDart) {
  if (!d) return "—";
  if (d.v === 0) return "MISS";
  if (d.v === 25) return d.mult === 2 ? "DBULL" : "BULL";
  return `${d.mult === 3 ? "T" : d.mult === 2 ? "D" : "S"}${d.v}`;
}
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
  try { return localStorage.getItem(key); } catch { return null; }
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
  // (condensé)
  const res: string[] = [];
  const push = (s: string) => res.push(s);
  if (!doubleOut) {
    if (rest <= 50 && SINGLE_SET.has(rest)) push(rest === 50 ? "BULL" : rest === 25 ? "25" : `S${rest}`);
    const tryTwo = (label: string, pts: number) => {
      const r = rest - pts;
      if (SINGLE_SET.has(r)) push(`${label} S${r}`);
    };
    tryTwo("T20", 60); tryTwo("T19", 57); tryTwo("T18", 54); tryTwo("50", 50); tryTwo("25", 25);
  } else {
    const map: Record<number, string> = {
      170: "T20 T20 D25", 167: "T20 T19 D25", 164: "T20 T18 D25", 161: "T20 T17 D25",
      160: "T20 T20 D20", 158: "T20 T20 D19", 157: "T20 T19 D20", 156: "T20 T20 D18",
      155: "T20 T19 D19", 154: "T20 T18 D20", 153: "T20 T19 D18", 152: "T20 T20 D16",
      151: "T20 T17 D20", 150: "T20 T18 D18",
      140: "T20 T20 D10", 139: "T20 T13 D20", 138: "T20 T18 D12", 137: "T20 T15 D16",
      136: "T20 T20 D8", 135: "T20 T17 D12",
      130: "T20 T18 D8", 129: "T19 T16 D12", 128: "T18 T14 D16", 127: "T20 T17 D8",
      126: "T19 T19 D6", 125: "25 T20 D20", 124: "T20 T16 D8", 123: "T19 T16 D9",
      122: "T18 T18 D7", 121: "T20 11 D25", 120: "T20 20 D20", 119: "T19 10 D25",
      118: "T20 18 D20", 117: "T20 17 D20", 116: "T20 16 D20", 115: "T20 15 D20",
      110: "T20 10 D20", 109: "T20 9 D20", 108: "T20 16 D16", 107: "T19 18 D16",
      101: "T20 9 D16", 100: "T20 D20", 99: "T19 10 D16", 98: "T20 D19", 97: "T19 D20",
      96: "T20 D18", 95: "T19 D19", 94: "T18 D20", 93: "T19 D18", 92: "T20 D16",
      91: "T17 D20", 90: "T18 D18", 89: "T19 D16", 88: "T16 D20", 87: "T17 D18",
      86: "T18 D16", 85: "T15 D20", 84: "T16 D18", 83: "T17 D16", 82: "BULL D16",
      81: "T15 D18", 80: "T20 D10", 79: "T19 D11", 78: "T18 D12", 77: "T19 D10",
      76: "T20 D8", 75: "T17 D12", 74: "T14 D16", 73: "T19 D8", 72: "T16 D12",
      71: "T13 D16", 70: "T20 D5",
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

  // ===== Overlay de manche + stats riches
  const [lastLegResult, setLastLegResult] = React.useState<LegResult | null>(null);
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  // ===== Log volées
  const [visitsLog, setVisitsLog] = React.useState<Visit[]>([]);
  const visitNoRef = React.useRef<number>(0);
  function pushVisitLog(opts: {
    playerId: string;
    score: number;
    remainingAfter: number;
    bust?: boolean;
    isCheckout?: boolean;
    dartsUsed?: number;
  }) {
    visitNoRef.current += 1;
    setVisitsLog((arr) => [
      ...arr,
      {
        playerId: opts.playerId,
        visitNo: visitNoRef.current,
        score: opts.score,
        segments: null,
        bust: !!opts.bust,
        isCheckout: !!opts.isCheckout,
        dartsUsed: opts.dartsUsed,
        remainingAfter: opts.remainingAfter,
      },
    ]);
  }

  // ===== onFinish différé
  const [pendingFinish, setPendingFinish] = React.useState<MatchRecord | null>(null);
  const defaultFinishPolicy: FinishPolicy = finishPref ?? ((safeGetLocalStorage("opt_continue_policy") ?? "firstToZero") as FinishPolicy);

  // ====== Hook moteur (⚠️ propage outMode/inMode + set/leg)
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
    onLegEnd: async (res: LegResult) => {
      setLastLegResult(res);
      setOverlayOpen(true);

      let enriched: any = res;
      try {
        const legInput: LegInput = {
          startScore: startScore,
          players: ((state.players || []) as { id: string }[]).map((p) => p.id),
          visits: visitsLog,
          finishedAt: Date.now(),
          legNo: res.legNo ?? 1,
          winnerId: res.winnerId ?? null,
        };
        const legStats: RichLegStats = computeLegStats(legInput);
        enriched = { ...(res as any), __legStats: legStats };
        setLastLegResult(enriched as LegResult);
      } catch (e) {
        console.warn("computeLegStats() error:", e);
      }

      try {
        await commitFinishedLeg({ result: enriched as any, resumeId, kind: "x01" });
      } catch (e) {
        console.warn("commitFinishedLeg failed:", e);
      }

      visitNoRef.current = 0;
      setVisitsLog([]);
    },
  });

  // Historique id
  const historyIdRef = React.useRef<string | undefined>(resumeId);
  const matchIdRef = React.useRef<string>(resumeId ?? (crypto.randomUUID?.() ?? String(Date.now())));

  // Commit auto stats globales (basics) à chaque fin de manche
  React.useEffect(() => {
    if (!lastLegResult) return;
    const res = lastLegResult;

    const playersNow = ((state.players || []) as EnginePlayer[]).map((p) => ({
      id: p.id, name: p.name,
    }));

    const legId = `${matchIdRef.current || "local"}::set#${currentSet}::leg#${res.legNo || currentLegInSet}`;

    const perPlayer: Record<string, any> = {};
    const ids = Object.keys(res.darts || {});
    for (const pid of ids) {
      const dartsThrown = (res.darts as any)?.[pid] || 0;
      const visits = (res.visits as any)?.[pid] || Math.ceil(dartsThrown / 3);
      const avg3 = (res.avg3 as any)?.[pid] || 0;
      const pointsScored = Math.round(avg3 * visits);

      perPlayer[pid] = {
        dartsThrown, pointsScored, visits, avg3,
        bestVisit: (res.bestVisit as any)?.[pid] || 0,
        highestCheckout: (res.bestCheckout as any)?.[pid] || 0,
        tons60: (res.h60 as any)?.[pid] || 0,
        tons100: (res.h100 as any)?.[pid] || 0,
        tons140: (res.h140 as any)?.[pid] || 0,
        ton180: (res.h180 as any)?.[pid] || 0,
        checkoutAttempts: 0,
        checkoutHits: 0,
        legsPlayed: 1,
        legsWon: res.winnerId === pid ? 1 : 0,
      };
    }

    commitLegStatsOnce({
      legId,
      kind: "x01",
      finishedAt: res.finishedAt ?? Date.now(),
      players: playersNow,
      winnerId: res.winnerId,
      perPlayer,
    });
  }, [lastLegResult, state.players, currentSet, currentLegInSet]);

  // Persistance “en cours”
  function buildEngineLike(dartsThisTurn: UIDart[], winnerId?: string | null) {
    const playersArr: EnginePlayer[] = ((state.players || []) as EnginePlayer[]).map((p) => ({ id: p.id, name: p.name }));
    const scores: number[] = playersArr.map((p) => scoresByPlayer[p.id] ?? startScore);
    const idx = playersArr.findIndex((p) => p.id === (currentPlayer?.id as string));
    return {
      rules: { start: startScore, doubleOut: outM !== "simple", setsToWin: setsTarget, legsPerSet: legsTarget, outMode: outM, inMode: inM },
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

  // ----- Statistiques live pour l’affichage
  const [lastByPlayer, setLastByPlayer] = React.useState<Record<string, UIDart[]>>({});
  const [lastBustByPlayer, setLastBustByPlayer] = React.useState<Record<string, boolean>>({});
  const [dartsCount, setDartsCount] = React.useState<Record<string, number>>({});
  const [pointsSum, setPointsSum] = React.useState<Record<string, number>>({});
  const [visitsCount, setVisitsCount] = React.useState<Record<string, number>>({});
  const [bestVisitByPlayer, setBestVisitByPlayer] = React.useState<Record<string, number>>({});
  const [hitsByPlayer, setHitsByPlayer] = React.useState<Record<string, { h60: number; h100: number; h140: number; h180: number }>>({});
  const [impactByPlayer, setImpactByPlayer] = React.useState<Record<string, { doubles: number; triples: number; bulls: number }>>({});

  type Bucket = { inner: number; outer: number; double: number; triple: number; miss: number };
  const [perPlayerBuckets, setPerPlayerBuckets] = React.useState<Record<string, Record<string, Bucket>>>({});

  // SFX
  const dartHit = React.useMemo(() => createAudio(["/sounds/dart-hit.mp3", "/sounds/dart-hit.ogg"]), []);
  const bustSnd = React.useMemo(() => createAudio(["/sounds/bust.mp3", "/sounds/bust.ogg"]), []);
  const voiceOn = React.useMemo<boolean>(() => (safeGetLocalStorage("opt_voice") ?? "true") === "true", []);

  function playDartSfx(d: UIDart, nextThrow: UIDart[]) {
    const visitSum = nextThrow.reduce((s, x) => s + dartValue(x), 0);
    if (nextThrow.length === 3 && visitSum === 180) { playSound("180"); return; }
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

  const currentRemaining = scoresByPlayer[(currentPlayer?.id as string) || ""] ?? startScore;
  const volleyTotal = currentThrow.reduce((s, d) => s + dartValue(d), 0);
  const predictedAfter = Math.max(currentRemaining - volleyTotal, 0);

  function handleNumber(n: number) {
    if (currentThrow.length >= 3) return;
    const d: UIDart = { v: n, mult: n === 0 ? 1 : multiplier };
    const next = [...currentThrow, d];
    playDartSfx(d, next);
    try { dartHit.currentTime = 0; dartHit.play(); } catch {}
    (navigator as any).vibrate?.(25);
    setCurrentThrow(next);
    setMultiplier(1);
  }
  function handleBull() {
    if (currentThrow.length >= 3) return;
    const d: UIDart = { v: 25, mult: multiplier === 2 ? 2 : 1 };
    const next = [...currentThrow, d];
    playDartSfx(d, next);
    try { dartHit.currentTime = 0; dartHit.play(); } catch {}
    (navigator as any).vibrate?.(25);
    setCurrentThrow(next);
    setMultiplier(1);
  }

  // ----- Validation d’une volée
  function validateThrow() {
    if (!currentThrow.length || !currentPlayer) return;

    const volleyPts = currentThrow.reduce((s, d) => s + dartValue(d), 0);
    const after = currentRemaining - volleyPts;

    let willBust = after < 0;
    const needDoubleOut = outM !== "simple";
    if (!willBust && needDoubleOut && after === 0) willBust = !isDoubleFinish(currentThrow);

    const ptsForStats = willBust ? 0 : volleyPts;

    // Log visite
    {
      const isCheckout = !willBust && after === 0;
      pushVisitLog({
        playerId: currentPlayer.id,
        score: ptsForStats,
        remainingAfter: Math.max(after, 0),
        bust: willBust,
        isCheckout,
        dartsUsed: isCheckout ? currentThrow.length : 3,
      });
    }

    // Stats live
    setDartsCount((m) => ({ ...m, [currentPlayer.id]: (m[currentPlayer.id] || 0) + currentThrow.length }));
    setPointsSum((m) => ({ ...m, [currentPlayer.id]: (m[currentPlayer.id] || 0) + ptsForStats }));
    setVisitsCount((m) => ({ ...m, [currentPlayer.id]: (m[currentPlayer.id] || 0) + 1 }));
    setBestVisitByPlayer((m) => ({ ...m, [currentPlayer.id]: Math.max(m[currentPlayer.id] || 0, volleyPts) }));
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
    setPerPlayerBuckets((m) => {
      const cur = m[currentPlayer.id] || {};
      const key = `set-${currentSet}-leg-${currentLegInSet}`;
      const b = cur[key] || { inner: 0, outer: 0, double: 0, triple: 0, miss: 0 };
      for (const d of currentThrow) {
        if (d.v === 0) b.miss++;
        else if (d.v === 25) { if (d.mult === 2) { b.inner++; b.double++; } else b.outer++; }
        else if (d.mult === 2) b.double++;
        else if (d.mult === 3) b.triple++;
        else b.outer++;
      }
      return { ...m, [currentPlayer.id]: { ...cur, [key]: b } };
    });

    persistAfterThrow(currentThrow);
    submitThrowUI(currentThrow);

    setLastByPlayer((m) => ({ ...m, [currentPlayer.id]: currentThrow }));
    setLastBustByPlayer((m) => ({ ...m, [currentPlayer.id]: !!willBust }));

    if (willBust) {
      try { bustSnd.currentTime = 0; bustSnd.play(); } catch {}
      (navigator as any).vibrate?.([120, 60, 140]);
    } else {
      const voice = voiceOn && "speechSynthesis" in window;
      if (voice) {
        const u = new SpeechSynthesisUtterance(`${currentPlayer.name || ""}, ${volleyPts} points`);
        u.rate = 1; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      }
    }

    setCurrentThrow([]);
    setMultiplier(1);
  }

  function handleBackspace() { playSound("dart-hit"); setCurrentThrow((t) => t.slice(0, -1)); }
  function handleCancel() { playSound("bust"); if (currentThrow.length) setCurrentThrow((t) => t.slice(0, -1)); else undoLast?.(); }

  const liveRanking = React.useMemo<RankItem[]>(() => {
    const items: RankItem[] = ((state.players || []) as EnginePlayer[]).map((p) => ({
      id: p.id, name: p.name, score: scoresByPlayer[p.id] ?? startScore,
    }));
    items.sort((a, b) => {
      const az = a.score === 0, bz = b.score === 0;
      if (az && !bz) return -1;
      if (!az && bz) return 1;
      return a.score - b.score;
    });
    return items;
  }, [state.players, scoresByPlayer, startScore]);

  function chipStyle(d?: UIDart, red = false): React.CSSProperties {
    if (!d)
      return { background: "rgba(255,255,255,.06)", color: "#bbb", border: "1px solid rgba(255,255,255,.08)" };
    if (red)
      return { background: "rgba(200,30,30,.18)", color: "#ff8a8a", border: "1px solid rgba(255,80,80,.35)" };
    if (d.v === 25 && d.mult === 2)
      return { background: "rgba(13,160,98,.18)", color: "#8ee6bf", border: "1px solid rgba(13,160,98,.35)" };
    if (d.v === 25)
      return { background: "rgba(13,160,98,.12)", color: "#7bd6b0", border: "1px solid rgba(13,160,98,.3)" };
    if (d.mult === 3)
      return { background: "rgba(179,68,151,.18)", color: "#ffd0ff", border: "1px solid rgba(179,68,151,.35)" };
    if (d.mult === 2)
      return { background: "rgba(46,150,193,.18)", color: "#cfeaff", border: "1px solid rgba(46,150,193,.35)" };
    return { background: "rgba(255,187,51,.12)", color: "#ffc63a", border: "1px solid rgba(255,187,51,.4)" };
  }

  const goldBtn: React.CSSProperties = {
    borderRadius: 10, padding: "6px 12px", border: "1px solid rgba(255,180,0,.3)",
    background: "linear-gradient(180deg, #ffc63a, #ffaf00)", color: "#1a1a1a",
    fontWeight: 900, boxShadow: "0 10px 22px rgba(255,170,0,.28)", cursor: "pointer",
  };

  const flushPendingFinish = React.useCallback(() => {
    if (pendingFinish) {
      const m: MatchRecord = pendingFinish;
      setPendingFinish(null); setOverlayOpen(false); onFinish(m); return;
    }
    const rec: MatchRecord = makeX01RecordFromEngineCompat({
      engine: buildEngineLike([], winner?.id ?? null),
      existingId: historyIdRef.current,
    });
    History.upsert(rec); historyIdRef.current = rec.id; onFinish(rec);
  }, [pendingFinish, onFinish, winner?.id]);

  if (!state.players?.length) {
    return (
      <div style={{ padding: 16, maxWidth: CONTENT_MAX, margin: "0 auto" }}>
        <button onClick={() => (pendingFinish ? flushPendingFinish() : onExit())} style={goldBtn}>← Quitter</button>
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

  // Fin de match : narration + sauvegardes additionnelles
  const prevIsOver = React.useRef(false);
  React.useEffect(() => {
    const justFinished = !prevIsOver.current && isOver;
    prevIsOver.current = isOver;

    if (justFinished) {
      persistOnFinish();

      try {
        const maybeLeg: RichLegStats | undefined = (lastLegResult as any)?.__legStats;
        if (maybeLeg) {
          const m = aggregateMatch([maybeLeg], maybeLeg.players);
          const playersArr: EnginePlayer[] = ((state.players || []) as EnginePlayer[]);
          const standing = playersArr
            .map((p) => ({ id: p.id, score: scoresByPlayer[p.id] ?? startScore }))
            .sort((a, b) => a.score - b.score);
          const rec: any = {
            id: crypto.randomUUID?.() ?? String(Date.now()),
            createdAt: Date.now(),
            rules: {
              x01Start: startScore,
              finishPolicy: outM !== "simple" ? "doubleOut" : "singleOut",
              setsToWin: setsTarget, legsPerSet: legsTarget,
            },
            players: playersArr.map((p) => p.id),
            winnerId: standing[0]?.id ?? winner?.id ?? playersArr[0]?.id,
            computed: m,
          };
          saveMatchStats(rec);
        }
      } catch (e) {
        console.warn("aggregateMatch/saveMatchStats:", e);
      }
    }

    const voice = (safeGetLocalStorage("opt_voice") ?? "true") === "true";
    if (!justFinished || !voice || !("speechSynthesis" in window)) return;
    const ords = ["", "Deuxième", "Troisième", "Quatrième", "Cinquième", "Sixième", "Septième", "Huitième"];
    const ordered = [...liveRanking].sort((a, b) => {
      const az = a.score === 0, bz = b.score === 0;
      if (az && !bz) return -1; if (!az && bz) return 1; return a.score - b.score;
    });
    const parts: string[] = [];
    if (ordered[0]) parts.push(`Victoire ${ordered[0].name}`);
    for (let i = 1; i < ordered.length && i < 8; i++) parts.push(`${ords[i]} ${ordered[i].name}`);
    const text = parts.join(". ") + ".";
    const u = new SpeechSynthesisUtterance(text); u.rate = 1; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
  }, [isOver, liveRanking, winner?.id, lastLegResult, state.players, scoresByPlayer, startScore, setsTarget, legsTarget, outM]);

  const showEndBanner = isOver && !pendingFirstWin && !isContinuing;

  // Musique fond overlay / fin
  const [bgMusic] = React.useState(() => new Audio("/sounds/victory.mp3"));
  React.useEffect(() => {
    if (overlayOpen || showEndBanner) {
      try { bgMusic.loop = true; bgMusic.volume = 0.6; bgMusic.currentTime = 0; bgMusic.play().catch(() => {}); } catch {}
    } else {
      try { bgMusic.pause(); bgMusic.currentTime = 0; } catch {}
    }
  }, [overlayOpen, showEndBanner, bgMusic]);

  // Force overlay si fin moteur (fallback si pas de res détaillé)
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
      for (const p of playersArr) {
        const pid = p.id;
        const dCount = dartsCount[pid] || 0;
        const pSum = pointsSum[pid] || 0;
        const a3d = dCount > 0 ? (pSum / dCount) * 3 : 0;
        remaining[pid] = scoresByPlayer[pid] ?? startScore;
        darts[pid] = dCount;
        visits[pid] = visitsCount[pid] || Math.ceil(dCount / 3);
        avg3[pid] = Math.round(a3d * 100) / 100;
        bestVisit[pid] = bestVisitByPlayer[pid] || 0;
        bestCheckout[pid] = 0;
        h60[pid] = hitsByPlayer[pid]?.h60 || 0;
        h100[pid] = hitsByPlayer[pid]?.h100 || 0;
        h140[pid] = hitsByPlayer[pid]?.h140 || 0;
        h180[pid] = hitsByPlayer[pid]?.h180 || 0;
      }
      const order = [...playersArr]
        .sort((a, b) => {
          const as = remaining[a.id] ?? startScore;
          const bs = remaining[b.id] ?? startScore;
          if (as === 0 && bs !== 0) return -1;
          if (bs === 0 && as !== 0) return 1;
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
      } as LegResult);
    }
  }, [isOver]);

  return (
    <div className="x01play-container" style={{ paddingBottom: Math.round(KEYPAD_HEIGHT * KEYPAD_SCALE) + NAV_HEIGHT + 16 }}>
      {/* Barre haute */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, maxWidth: CONTENT_MAX, marginInline: "auto", paddingInline: 12 }}>
        <button onClick={() => (pendingFinish ? flushPendingFinish() : onExit())} style={goldBtn}>← Quitter</button>
        <div />
      </div>

      {/* HEADER sticky — centré */}
      <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", paddingInline: 12 }}>
        <HeaderBlock
          currentPlayer={currentPlayer}
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

      {/* Bloc joueurs (accordéon) — centré */}
      <div style={{ maxWidth: CONTENT_MAX, margin: "0 auto", paddingInline: 12 }}>
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
        />
      </div>

      {/* Spacer keypad */}
      <div style={{ height: Math.round(KEYPAD_HEIGHT * KEYPAD_SCALE) + 8 }} />

      {/* Keypad FIXED */}
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

      {/* Modale CONTINUER ? */}
      {pendingFirstWin && <ContinueModal endNow={endNow} continueAfterFirst={continueAfterFirst} />}

      {/* Overlay fin de manche */}
      <EndOfLegOverlay
        open={overlayOpen}
        result={lastLegResult as any}
        playersById={React.useMemo(
          () =>
            Object.fromEntries(
              ((state.players || []) as EnginePlayer[]).map((p) => {
                const prof = profileById[p.id];
                return [p.id, { id: p.id, name: p.name, avatarDataUrl: prof?.avatarDataUrl }];
              })
            ),
          [state.players, profileById]
        )}
        onClose={() => setOverlayOpen(false)}
        onReplay={() => setOverlayOpen(false)}
        onSave={(res) => {
          try {
            const playersNow = ((state.players || []) as EnginePlayer[]).map((p) => ({
              id: p.id,
              name: p.name,
              avatarDataUrl: (profiles.find((pr) => pr.id === p.id)?.avatarDataUrl ?? null) as string | null,
            }));
            History.upsert({
              kind: "leg",
              id: crypto.randomUUID?.() ?? String(Date.now()),
              status: "finished",
              players: playersNow,
              updatedAt: Date.now(),
              createdAt: Date.now(),
              payload: { ...res, meta: { currentSet, currentLegInSet, setsTarget, legsTarget } },
            } as any);
            (navigator as any).vibrate?.(50);
          } catch (e) { console.warn("Impossible de sauvegarder la manche:", e); }
          setOverlayOpen(false);
        }}
      />

      {/* Bandeau fin de partie */}
      {showEndBanner && (
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
      currentPlayer, currentAvatar, currentRemaining, currentThrow, doubleOut, liveRanking,
      curDarts, curM3D, bestVisit, currentSet, currentLegInSet, setsTarget, legsTarget
    } = props;
    const volleyTotal = currentThrow.reduce((s, d) => s + dartValue(d), 0);
    const predictedAfter = Math.max(currentRemaining - volleyTotal, 0);

    const chip: React.CSSProperties = {
      display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px",
      borderRadius: 999, border: "1px solid rgba(255,200,80,.35)",
      background: "linear-gradient(180deg, rgba(255,195,26,.12), rgba(30,30,34,.95))",
      color: "#ffcf57", fontWeight: 800, fontSize: 12, boxShadow: "0 6px 18px rgba(255,195,26,.15)", whiteSpace: "nowrap",
    };

    return (
      <div
        style={{
          position: "sticky", top: 0, zIndex: 40, transform: `scale(${HEADER_SCALE})`, transformOrigin: "top center",
          background: "radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.10), transparent 55%), linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.8))",
          border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: HEADER_OUTER_PADDING,
          boxShadow: "0 10px 30px rgba(0,0,0,.35)", marginBottom: 10,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center" }}>
          {/* Colonne gauche : Avatar + Nom + Mini-Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
            <div
              style={{
                padding: 6, borderRadius: "50%",
                WebkitMaskImage: "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
                maskImage: "radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)",
              }}
            >
              <div
                style={{
                  width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: "50%", overflow: "hidden",
                  background: "linear-gradient(180deg, #1b1b1f, #111114)", boxShadow: "0 8px 28px rgba(0,0,0,.35)",
                }}
              >
                {currentAvatar ? (
                  <img src={currentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontWeight: 700 }}>?</div>
                )}
              </div>
            </div>

            <div style={{ fontWeight: 900, fontSize: 18, color: "#ffcf57", letterSpacing: 0.3 }}>
              {currentPlayer?.name ?? "—"}
            </div>

            <div style={{ ...miniCard, width: MINI_CARD_WIDTH, height: MINI_CARD_HEIGHT, padding: 8 }}>
              <div style={miniText}>
                <div>Meilleure volée : <b>{Math.max(0, bestVisit)}</b></div>
                <div>Moy/3D : <b>{curM3D}</b></div>
                <div>Darts jouées : <b>{curDarts}</b></div>
                <div>Volée : <b>{Math.min(currentThrow.length, 3)}/3</b></div>
              </div>
            </div>
          </div>

          {/* Centre : score + volée + checkout + chips Set/Leg + mini-classement */}
          <div style={{ textAlign: "center", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 72, lineHeight: 1, fontWeight: 900, color: "#ffcf57", textShadow: "0 4px 20px rgba(255,195,26,.25)", letterSpacing: 0.5, marginTop: 2 }}>
              {Math.max(currentRemaining - currentThrow.reduce((s, d) => s + dartValue(d), 0), 0)}
            </div>

            {/* Pastilles volée */}
            <div style={{ marginTop: 2, display: "flex", gap: 6, justifyContent: "center" }}>
              {[0, 1, 2].map((i: number) => {
                const d = currentThrow[i];
                const afterNow = currentRemaining - currentThrow.slice(0, i + 1).reduce((s, x) => s + dartValue(x), 0);
                const wouldBust = afterNow < 0 || (doubleOut && afterNow === 0 && !isDoubleFinish(currentThrow.slice(0, i + 1)));
                const st = chipStyle(d, wouldBust);
                return (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    minWidth: 44, height: 32, padding: "0 12px", borderRadius: 10,
                    border: st.border as string, background: st.background as string, color: st.color as string, fontWeight: 800,
                  }}>
                    {fmt(d)}
                  </span>
                );
              })}
            </div>

            {/* Chips Set/Leg */}
            <div style={{ marginTop: 2, display: "flex", justifyContent: "center" }}>
              <span style={chip}>
                <span>Set {currentSet}/{setsTarget}</span>
                <span style={{ opacity: .6 }}>•</span>
                <span>Leg {currentLegInSet}/{legsTarget}</span>
              </span>
            </div>

            {/* Checkout */}
            {(() => {
              const only = suggestCheckout(predictedAfter, outM !== "simple", (3 - currentThrow.length) as 1 | 2 | 3)[0];
              if (!only || currentThrow.length >= 3) return null;
              return (
                <div style={{ marginTop: 4, display: "flex", justifyContent: "center" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: 6, borderRadius: 12, border: "1px solid rgba(255,255,255,.08)",
                    background: "radial-gradient(120% 120% at 50% 0%, rgba(255,195,26,.10), rgba(30,30,34,.95))",
                    minWidth: 180, maxWidth: 520,
                  }}>
                    <span style={{
                      padding: "4px 8px", borderRadius: 8, border: "1px solid rgba(255,187,51,.4)",
                      background: "rgba(255,187,51,.12)", color: "#ffc63a", fontWeight: 900, whiteSpace: "nowrap",
                    }}>
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
                    <div style={miniRankName}>{i + 1}. {r.name}</div>
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
  }) {
    const {
      playersOpen, setPlayersOpen, statePlayers, profileById, lastByPlayer, lastBustByPlayer,
      dartsCount, pointsSum, start, scoresByPlayer, currentSet, currentLegInSet, setsTarget, legsTarget,
    } = props;

    const headerChip: React.CSSProperties = {
      display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px",
      borderRadius: 999, border: "1px solid rgba(255,200,80,.32)",
      background: "linear-gradient(180deg, rgba(255,195,26,.10), rgba(28,28,32,.95))",
      color: "#ffcf57", fontWeight: 800, fontSize: 12, boxShadow: "0 6px 16px rgba(255,195,26,.12)", whiteSpace: "nowrap",
    };

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
        {/* ENTÊTE : JOUEURS + Set/Leg + disclosure */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 6px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              padding: "6px 10px", borderRadius: 8, background: "linear-gradient(180deg, #ffc63a, #ffaf00)",
              color: "#151517", fontWeight: 900, letterSpacing: .4,
            }}>
              JOUEURS
            </span>

            <span style={headerChip}>
              <span>Set {currentSet}/{setsTarget}</span>
              <span style={{ opacity: .6 }}>•</span>
              <span>Leg {currentLegInSet}/{legsTarget}</span>
            </span>
          </div>

          <button
            onClick={() => setPlayersOpen(!playersOpen)}
            aria-label="Afficher / masquer les joueurs"
            style={{
              width: 30, height: 30, borderRadius: 10,
              border: "1px solid rgba(255,255,255,.12)", background: "transparent",
              color: "#e8e8ec", cursor: "pointer", fontWeight: 900
            }}
          >
            {playersOpen ? "▴" : "▾"}
          </button>
        </div>

        {playersOpen && (
          <div style={{ marginTop: 4, maxHeight: `${PLAYERS_LIST_MAX_H_VH}vh`, overflow: "auto", paddingRight: 4 }}>
            {statePlayers.map((p) => {
              const prof = profileById[p.id];
              const avatarSrc = (prof?.avatarDataUrl as string | null) ?? null;
              const last = lastByPlayer[p.id] || [];
              const bust = !!lastBustByPlayer[p.id];
              const dCount = dartsCount[p.id] || 0;
              const pSum = pointsSum[p.id] || 0;
              const a3d = dCount > 0 ? ((pSum / dCount) * 3).toFixed(2) : "0.00";

              return (
                <div
                  key={p.id}
                  style={{
                    display: "flex", alignItems: "center", gap: PLAYER_ROW_GAP,
                    padding: `${PLAYER_ROW_PAD_Y}px 10px`, borderRadius: 12,
                    background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
                    border: "1px solid rgba(255,255,255,.07)", marginBottom: 6,
                  }}
                >
                  <div style={{ width: PLAYER_ROW_AVATAR, height: PLAYER_ROW_AVATAR, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,.06)", flex: "0 0 auto" }}>
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontWeight: 700, fontSize: 12 }}>?</div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#ffcf57" }}>{p.name}</div>
                      {last.length > 0 ? (
                        last.map((d, i) => {
                          const st = chipStyle(d, bust);
                          return (
                            <span
                              key={i}
                              style={{
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                minWidth: 34, height: 24, padding: "0 8px", borderRadius: 8,
                                border: st.border as string, background: st.background as string, color: st.color as string,
                                fontWeight: 800, fontSize: 12,
                              }}
                            >
                              {fmt(d)}
                            </span>
                          );
                        })
                      ) : (
                        <span style={{ color: "#aab", fontSize: 12 }}>Dernière volée : —</span>
                      )}
                    </div>

                    <div style={{ marginTop: 3, fontSize: 11.5, color: "#cfd1d7" }}>
                      Set {currentSet} • Leg {currentLegInSet} • Darts: {dCount} • Moy/3D: {a3d}
                    </div>
                  </div>

                  <div style={{ fontWeight: 900, color: (scoresByPlayer[p.id] ?? start) === 0 ? "#7fe2a9" : "#ffcf57" }}>
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

  function ContinueModal({ endNow, continueAfterFirst }: { endNow: () => void; continueAfterFirst: () => void }) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16,
        }}
      >
        <div
          style={{
            width: 460, background: "linear-gradient(180deg, #17181c, #101116)",
            border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 18,
          }}
        >
          <h3 style={{ margin: "0 0 8px" }}>Continuer la manche ?</h3>
          <p style={{ opacity: 0.8, marginTop: 0 }}>
            Le premier joueur a terminé. Tu peux <b>terminer maintenant</b> (classement figé) ou <b>continuer</b> jusqu’à l’avant-dernier.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={endNow}
              style={{ appearance: "none" as const, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "#eee", cursor: "pointer" }}
            >
              Terminer maintenant
            </button>
            <button
              onClick={continueAfterFirst}
              style={{
                appearance: "none" as const, padding: "10px 14px", borderRadius: 12, border: "1px solid transparent",
                background: "linear-gradient(180deg, #f0b12a, #c58d19)", color: "#141417", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 24px rgba(240,177,42,.25)",
              }}
            >
              CONTINUER
            </button>
          </div>
        </div>
      </div>
    );
  }

  function EndBanner({
    winnerName, continueAfterFirst, openOverlay, flushPendingFinish, goldBtn,
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
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: NAV_HEIGHT + Math.round(KEYPAD_HEIGHT * KEYPAD_SCALE) + 80,
          zIndex: 47, background: "linear-gradient(180deg, #ffc63a, #ffaf00)", color: "#1a1a1a",
          fontWeight: 900, textAlign: "center", padding: 12, borderRadius: 12,
          boxShadow: "0 10px 28px rgba(0,0,0,.35)", display: "flex", gap: 12, alignItems: "center",
        }}
      >
        <span>Victoire : {winnerName}</span>
        <button onClick={continueAfterFirst} style={goldBtn}>Continuer (laisser finir)</button>
        <button onClick={openOverlay} style={goldBtn}>Classement</button>
        <button onClick={flushPendingFinish} style={goldBtn}>Terminer</button>
      </div>
    );
  }
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
