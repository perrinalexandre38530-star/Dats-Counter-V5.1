// ============================================
// src/pages/X01Play.tsx
// Header sticky, Keypad fixed, Checkout centré sous la volée
// Sons (dart/bust), vibration, TTS (volée & fin de partie)
// Avatar agrandi, NOM centré au-dessus du score
// Mini-Stats + mini-Classement compacts
// Bouton QUITTER doré
// + Reprise/sauvegarde Historique (History.upsert + resumeId)
// + CONTINUER jusqu’à l’avant-dernier + Overlay Classement/Stats de manche
// + Garde-fou: différer onFinish pour laisser voir le classement
// + Construction/sauvegarde Stats de match (saveMatchStats)
// + Commit auto des stats globales à chaque fin de manche (commitLegStatsOnce)
// + SFX intégrés (double/triple/bull/DBull/180 + touches Keypad)
// + [NEW] Log de volées + computeLegStats()/aggregateMatch()
// + [FIX] Commit immédiat Fin de manche -> Historique + stats unifiées
// ============================================
import React from "react";
import { useX01Engine } from "../hooks/useX01Engine";
import Keypad from "../components/Keypad";
import EndOfLegOverlay from "../components/EndOfLegOverlay";
import { playSound } from "../lib/sound";

// Historique (⚠️ PAS d'import de makeX01RecordFromEngine ici)
import { History, type SavedMatch } from "../lib/history";

// Pont “stats unifiées”
import { mergeLegToBasics } from "../lib/statsBridge";

// Stats locales/riche (live + fin de manche)
import { commitLegStatsOnce } from "../lib/statsOnce";
import { saveMatchStats } from "../lib/stats";
import type { Visit, LegInput, LegStats as RichLegStats } from "../lib/stats";
import { computeLegStats, aggregateMatch } from "../lib/stats";

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

const NAV_HEIGHT = 64;
const KEYPAD_HEIGHT = 360;

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

/** Commite immédiatement la manche finie :
 *  - push dans stats unifiées (mergeLegToBasics)
 *  - upsert Historique en status:"finished"
 */
async function commitFinishedLeg(opts: {
  result: LegacyLegResultLite | import("../lib/stats").LegStats;
  resumeId?: string | null;
  kind?: "x01" | "cricket" | string;
}) {
  const { result, resumeId, kind = "x01" } = opts;

  // 1) Stats unifiées
  try {
    await mergeLegToBasics(result);
  } catch (e) {
    console.warn("[statsBridge] mergeLegToBasics failed:", e);
  }

  // 2) Historique (finished)
  try {
    const id = resumeId || (crypto.randomUUID?.() ?? String(Date.now()));
    const winnerId = pickWinnerId(result);
    const legNo = pickLegNo(result);
    await History.upsert({
      id,
      kind,
      status: "finished",
      updatedAt: Date.now(),
      winnerId,
      summary: { legNo, winnerId },
      payload: result,
    } as unknown as SavedMatch);
  } catch (e) {
    console.warn("[history] upsert failed:", e);
  }
}

/* ---------------------------------------------
   Helper local (compat) pour fabriquer un MatchRecord
   (remplace l'ancien makeX01RecordFromEngine exporté)
----------------------------------------------*/
function makeX01RecordFromEngineCompat(args: {
  engine: {
    rules: { start: number; doubleOut: boolean };
    players: EnginePlayer[];
    scores: number[];
    currentIndex: number;
    dartsThisTurn: UIDart[];
    sets?: number[] | undefined;
    legs?: number[] | undefined;
    winnerId: string | null;
  };
  existingId?: string;
}): MatchRecord {
  const { engine, existingId } = args;
  // Snapshot minimal (adapté à l’existant X01Snapshot)
  const payload = {
    state: {
      rules: engine.rules,
      players: engine.players,
      scores: engine.scores,
      currentIndex: engine.currentIndex,
      dartsThisTurn: engine.dartsThisTurn,
      sets: engine.sets,
      legs: engine.legs,
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

/* ---- Checkout suggestion (une route) ---- */
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
  const doubleMap: Record<number, string[]> = {
    170: ["T20 T20 D25"],
    167: ["T20 T19 D25"],
    164: ["T20 T18 D25"],
    161: ["T20 T17 D25"],
    160: ["T20 T20 D20"],
    158: ["T20 T20 D19"],
    157: ["T20 T19 D20"],
    156: ["T20 T20 D18"],
    155: ["T20 T19 D19"],
    154: ["T20 T18 D20"],
    153: ["T20 T19 D18"],
    152: ["T20 T20 D16"],
    151: ["T20 T17 D20"],
    150: ["T20 T18 D18", "T20 T20 D15"],
    149: ["T20 T19 D16"],
    148: ["T20 T16 D20", "T20 T20 D14"],
    147: ["T20 T17 D18"],
    146: ["T20 T18 D16"],
    145: ["T20 T15 D20", "T20 T19 D14"],
    144: ["T20 T20 D12", "T20 T16 D18"],
    143: ["T20 T17 D16"],
    142: ["T20 T14 D20", "T20 T18 D14"],
    141: ["T20 T19 D12"],
    140: ["T20 T20 D10"],
    139: ["T20 T13 D20", "T20 T19 D11"],
    138: ["T20 T18 D12"],
    137: ["T20 T15 D16", "T19 T16 D16"],
    136: ["T20 T20 D8"],
    135: ["T20 T17 D12", "BULL T15 D20"],
    134: ["T20 T14 D16", "T20 T16 D13"],
    133: ["T20 T19 D8", "BULL T19 D13"],
    132: ["T20 T16 D12", "BULL T14 D20"],
    131: ["T20 T13 D16", "T19 T16 D14"],
    130: ["T20 T18 D8", "T20 20 D25"],
    129: ["T19 T16 D12", "19 T20 BULL"],
    128: ["T18 T14 D16", "T20 T16 D10"],
    127: ["T20 T17 D8", "T19 20 BULL"],
    126: ["T19 T19 D6", "T19 19 BULL"],
    125: ["25 T20 D20", "BULL 25 50"],
    124: ["T20 T16 D8", "T19 T19 D8"],
    123: ["T19 T16 D9", "T19 16 BULL"],
    122: ["T18 T18 D7", "T18 18 BULL"],
    121: ["T20 11 D25", "T19 14 D25"],
    120: ["T20 20 D20"],
    119: ["T19 10 D25", "T19 12 D25"],
    118: ["T20 18 D20", "T20 10 D24"],
    117: ["T20 17 D20", "T19 20 D20"],
    116: ["T20 16 D20", "T19 19 D20"],
    115: ["T20 15 D20", "T19 18 D20"],
    114: ["T20 14 D20", "T19 17 D20"],
    113: ["T20 13 D20", "T19 16 D20"],
    112: ["T20 12 D20", "T20 20 D16"],
    111: ["T20 11 D20", "T19 14 D20"],
    110: ["T20 10 D20", "T20 18 D16"],
    109: ["T20 9 D20"],
    108: ["T20 16 D16"],
    107: ["T19 18 D16", "T20 15 D16"],
    106: ["T20 14 D16"],
    105: ["T20 13 D16", "T19 16 D16"],
    104: ["T18 18 D16"],
    103: ["T20 11 D16"],
    102: ["T20 10 D16"],
    101: ["T20 9 D16"],
    100: ["T20 D20"],
    99: ["T19 10 D16"],
    98: ["T20 D19"],
    97: ["T19 D20"],
    96: ["T20 D18"],
    95: ["T19 D19"],
    94: ["T18 D20"],
    93: ["T19 D18"],
    92: ["T20 D16"],
    91: ["T17 D20"],
    90: ["T18 D18", "BULL D20"],
    89: ["T19 D16"],
    88: ["T16 D20"],
    87: ["T17 D18"],
    86: ["T18 D16"],
    85: ["T15 D20"],
    84: ["T16 D18"],
    83: ["T17 D16"],
    82: ["BULL D16"],
    81: ["T15 D18"],
    80: ["T20 D10", "S20 D20"],
    79: ["T19 D11"],
    78: ["T18 D12"],
    77: ["T19 D10"],
    76: ["T20 D8"],
    75: ["T17 D12"],
    74: ["T14 D16"],
    73: ["T19 D8"],
    72: ["T16 D12"],
    71: ["T13 D16"],
    70: ["T20 D5", "S20 D25"],
    69: ["T19 D6"],
    68: ["T20 D4"],
    67: ["T17 D8"],
    66: ["T10 D18"],
    65: ["T11 D16"],
    64: ["T16 D8"],
    63: ["T13 D12"],
    62: ["T10 D16"],
    61: ["T15 D8"],
    60: ["S20 D20"],
    58: ["S18 D20"],
    57: ["S17 D20"],
    56: ["S16 D20"],
    55: ["S15 D20"],
    54: ["S14 D20"],
    53: ["S13 D20"],
    52: ["S12 D20"],
    51: ["S11 D20"],
    50: ["S10 D20", "BULL"],
    49: ["S9 D20"],
  };

  if (doubleOut) {
    const routes = (doubleMap[rest] ?? [])
      .filter((r) => r.split(" ").length <= dartsLeft)
      .sort((a, b) => a.split(" ").length - b.split(" ").length);
    return routes.length ? [routes[0]] : [];
  }

  const res: string[] = [];
  const push = (s: string) => res.push(s);

  if (rest <= 50 && SINGLE_SET.has(rest))
    push(rest === 50 ? "BULL" : rest === 25 ? "25" : `S${rest}`);

  const tryTwo = (label: string, pts: number) => {
    const r = rest - pts;
    if (SINGLE_SET.has(r)) push(`${label} S${r}`);
  };
  tryTwo("T20", 60);
  tryTwo("T19", 57);
  tryTwo("T18", 54);
  tryTwo("50", 50);
  tryTwo("25", 25);

  for (let a = 1; a <= 50; a++) {
    if (!SINGLE_SET.has(a)) continue;
    const b = rest - a;
    if (SINGLE_SET.has(b)) {
      push(`S${a} S${b}`);
      break;
    }
  }
  const tryThree = (l1: string, s1: number, l2: string, s2: number) => {
    const r = rest - s1 - s2;
    if (SINGLE_SET.has(r)) push(`${l1} ${l2} S${r}`);
  };
  tryThree("T20", 60, "T20", 60);
  tryThree("T20", 60, "T19", 57);
  tryThree("T20", 60, "T18", 54);
  tryThree("50", 50, "T20", 60);
  tryThree("50", 50, "T19", 57);
  tryThree("50", 50, "T18", 54);
  tryThree("25", 25, "T20", 60);
  tryThree("25", 25, "T19", 57);
  tryThree("25", 25, "T18", 54);

  const filtered = res
    .filter((r) => r.split(" ").length <= dartsLeft)
    .sort((a, b) => a.split(" ").length - b.split(" ").length);
  return filtered.length ? [filtered[0]] : [];
}

/* --------- Composant --------- */
export default function X01Play({
  profiles = [],
  playerIds = [],
  start = 501,
  doubleOut = true,
  onFinish,
  onExit,
  params,
}: {
  profiles?: Profile[];
  playerIds?: string[];
  start?: 301 | 501 | 701 | 1001;
  doubleOut?: boolean;
  onFinish: (m: MatchRecord) => void;
  onExit: () => void;
  params?: { resumeId?: string } | any;
}) {
  const resumeId: string | undefined = params?.resumeId;

  // Reprise snapshot X01
  const resumeSnapshot = React.useMemo<X01Snapshot | null>(() => {
    if (!resumeId) return null;
    const rec: SavedMatch | null | undefined =
      (History as any).getX01 ? (History as any).getX01(resumeId) : History.get(resumeId);
    if (!rec || rec.kind !== "x01") return null;
    const snap = (rec.payload as any)?.state as X01Snapshot | undefined;
    return snap ?? null;
  }, [resumeId]);

  // ===== Overlay de manche + stats riches (injectées)
  const [lastLegResult, setLastLegResult] = React.useState<LegResult | null>(null);
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  // ===== NEW: log de volées pour computeLegStats()
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

  const defaultFinishPolicy: FinishPolicy = (
    (safeGetLocalStorage("opt_continue_policy") ?? "firstToZero") as FinishPolicy
  );

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
  } = useX01Engine({
    profiles,
    playerIds,
    start,
    doubleOut,
    onFinish: (m: MatchRecord) => {
      if (overlayOpen || pendingFinish) setPendingFinish(m);
      else onFinish(m);
    },
    // @ts-ignore
    resume: resumeSnapshot,
    finishPolicy: defaultFinishPolicy,

    // ===== Fin de manche -> calcule & attache __legStats + COMMIT (Historique + stats unifiées)
    onLegEnd: async (res: LegResult) => {
      setLastLegResult(res);
      setOverlayOpen(true);

      let enriched: any = res;
      try {
        const legInput: LegInput = {
          startScore: start,
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

      // >>> ICI : commit (Historique + stats unifiées)
      try {
        await commitFinishedLeg({
          result: enriched as any, // accepte legacy ou LegStats-like
          resumeId,
          kind: "x01",
        });
      } catch (e) {
        console.warn("commitFinishedLeg failed:", e);
      }

      // reset logger pour manche suivante
      visitNoRef.current = 0;
      setVisitsLog([]);
    },
  });

  // Historique id
  const historyIdRef = React.useRef<string | undefined>(resumeId);
  const matchIdRef = React.useRef<string>(
    resumeId ?? (crypto.randomUUID?.() ?? String(Date.now()))
  );

  // ===== Commit auto des stats globales à chaque fin de manche (pour tes agrégations locales)
  React.useEffect(() => {
    if (!lastLegResult) return;
    const res = lastLegResult;

    const playersNow = ((state.players || []) as EnginePlayer[]).map((p) => ({
      id: p.id,
      name: p.name,
    }));

    const legId = `${matchIdRef.current || "local"}::leg#${res.legNo || 1}`;

    const perPlayer: Record<string, any> = {};
    const ids = Object.keys(res.darts || {});
    for (const pid of ids) {
      const dartsThrown = (res.darts as any)?.[pid] || 0;
      const visits = (res.visits as any)?.[pid] || Math.ceil(dartsThrown / 3);
      const avg3 = (res.avg3 as any)?.[pid] || 0;
      const pointsScored = Math.round(avg3 * visits);

      perPlayer[pid] = {
        dartsThrown,
        pointsScored,
        visits,
        avg3,
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
  }, [lastLegResult, state.players]);

  // Persistance après lancer (reprise en cours)
  function buildEngineLike(dartsThisTurn: UIDart[], winnerId?: string | null) {
    const playersArr: EnginePlayer[] = ((state.players || []) as EnginePlayer[]).map((p) => ({
      id: p.id,
      name: p.name,
    }));
    const scores: number[] = playersArr.map((p) => scoresByPlayer[p.id] ?? start);
    const idx = playersArr.findIndex((p) => p.id === (currentPlayer?.id as string));
    return {
      rules: { start, doubleOut },
      players: playersArr,
      scores,
      currentIndex: idx >= 0 ? idx : 0,
      dartsThisTurn,
      sets: undefined as number[] | undefined,
      legs: undefined as number[] | undefined,
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
  const [hitsByPlayer, setHitsByPlayer] = React.useState<
    Record<string, { h60: number; h100: number; h140: number; h180: number }>
  >({});
  const [impactByPlayer, setImpactByPlayer] = React.useState<
    Record<string, { doubles: number; triples: number; bulls: number }>
  >({});

  type Bucket = { inner: number; outer: number; double: number; triple: number; miss: number };
  const [perPlayerBuckets, setPerPlayerBuckets] = React.useState<
    Record<string, Record<string, Bucket>>
  >({});

  // SFX
  const dartHit = React.useMemo(() => createAudio(["/sounds/dart-hit.mp3", "/sounds/dart-hit.ogg"]), []);
  const bustSnd = React.useMemo(() => createAudio(["/sounds/bust.mp3", "/sounds/bust.ogg"]), []);
  const voiceOn = React.useMemo<boolean>(() => (safeGetLocalStorage("opt_voice") ?? "true") === "true", []);

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

  const currentRemaining = scoresByPlayer[(currentPlayer?.id as string) || ""] ?? start;
  const volleyTotal = currentThrow.reduce((s, d) => s + dartValue(d), 0);
  const predictedAfter = Math.max(currentRemaining - volleyTotal, 0);

  function handleNumber(n: number) {
    if (currentThrow.length >= 3) return;
    const d: UIDart = { v: n, mult: n === 0 ? 1 : multiplier };
    const next = [...currentThrow, d];
    playDartSfx(d, next);
    try {
      dartHit.currentTime = 0;
      dartHit.play();
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
      dartHit.currentTime = 0;
      dartHit.play();
    } catch {}
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
    if (!willBust && doubleOut && after === 0) willBust = !isDoubleFinish(currentThrow);
    const ptsForStats = willBust ? 0 : volleyPts;

    // ---- NEW: logger la volée (pour computeLegStats)
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
      const key = "leg-1";
      const b = cur[key] || { inner: 0, outer: 0, double: 0, triple: 0, miss: 0 };
      for (const d of currentThrow) {
        if (d.v === 0) b.miss++;
        else if (d.v === 25) {
          if (d.mult === 2) {
            b.inner++;
            b.double++;
          } else b.outer++;
        } else if (d.mult === 2) b.double++;
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
      try {
        bustSnd.currentTime = 0;
        bustSnd.play();
      } catch {}
      (navigator as any).vibrate?.([120, 60, 140]);
    } else if (voiceOn && "speechSynthesis" in window) {
      const name = currentPlayer.name || "";
      const u = new SpeechSynthesisUtterance(`${name}, ${volleyPts} points`);
      u.rate = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
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
      score: scoresByPlayer[p.id] ?? start,
    }));
    items.sort((a, b) => {
      const az = a.score === 0,
        bz = b.score === 0;
      if (az && !bz) return -1;
      if (!az && bz) return 1;
      return a.score - b.score;
    });
    return items;
  }, [state.players, scoresByPlayer, start]);

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

  if (!state.players?.length) {
    return (
      <div className="container" style={{ padding: 16 }}>
        <button onClick={() => (pendingFinish ? flushPendingFinish() : onExit())} style={goldBtn}>
          ← Quitter
        </button>
        <p>Aucun joueur sélectionné. Reviens au lobby.</p>
      </div>
    );
  }

  const currentAvatar =
    (currentPlayer && (profileById[currentPlayer.id]?.avatarDataUrl as string | null)) ?? null;

  const curDarts = currentPlayer ? dartsCount[currentPlayer.id] || 0 : 0;
  const curPts = currentPlayer ? pointsSum[currentPlayer.id] || 0 : 0;
  const curM3D = curDarts > 0 ? ((curPts / curDarts) * 3).toFixed(2) : "0.00";
  const dartsLeft = (3 - currentThrow.length) as 1 | 2 | 3;

  // Fin de match : narration + sauvegarde record + agrégation optionnelle
  const prevIsOver = React.useRef(false);
  React.useEffect(() => {
    const justFinished = !prevIsOver.current && isOver;
    prevIsOver.current = isOver;

    if (justFinished) {
      persistOnFinish();

      // agrégation simple si on a les stats de la dernière manche
      try {
        const maybeLeg: RichLegStats | undefined = (lastLegResult as any)?.__legStats;
        if (maybeLeg) {
          const m = aggregateMatch([maybeLeg], maybeLeg.players);
          const playersArr: EnginePlayer[] = ((state.players || []) as EnginePlayer[]);
          const standing = playersArr
            .map((p) => ({ id: p.id, score: scoresByPlayer[p.id] ?? start }))
            .sort((a, b) => a.score - b.score);
          const rec: any = {
            id: crypto.randomUUID?.() ?? String(Date.now()),
            createdAt: Date.now(),
            rules: {
              x01Start: start,
              finishPolicy: doubleOut ? "doubleOut" : "singleOut",
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

    // TTS classement final
    if (!justFinished || !voiceOn || !("speechSynthesis" in window)) return;
    const ords = ["", "Deuxième", "Troisième", "Quatrième", "Cinquième", "Sixième", "Septième", "Huitième"];
    const ordered = [...liveRanking].sort((a, b) => {
      const az = a.score === 0, bz = b.score === 0;
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
  }, [isOver, liveRanking, voiceOn, winner?.id, lastLegResult, state.players, scoresByPlayer, start, doubleOut]);

  // utilitaires flush
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFinish, onFinish, winner?.id]);

  const showEndBanner = isOver && !pendingFirstWin && !isContinuing;

  // Musique de fond à l’overlay / fin
  const [bgMusic] = React.useState(() => new Audio("/sounds/victory.mp3"));
  React.useEffect(() => {
    if (overlayOpen || showEndBanner) {
      try {
        bgMusic.loop = true;
        bgMusic.volume = 0.6;
        bgMusic.currentTime = 0;
        bgMusic.play().catch(() => {});
      } catch {}
    } else {
      try {
        bgMusic.pause();
        bgMusic.currentTime = 0;
      } catch {}
    }
  }, [overlayOpen, showEndBanner, bgMusic]);

  // Force overlay si fin match 2 joueurs (fallback legacy)
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
        remaining[pid] = scoresByPlayer[pid] ?? start;
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
          const as = remaining[a.id] ?? start;
          const bs = remaining[b.id] ?? start;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOver]);

  return (
    <div className="x01play-container" style={{ paddingBottom: KEYPAD_HEIGHT + NAV_HEIGHT + 16 }}>
      {/* Barre haute */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => (pendingFinish ? flushPendingFinish() : onExit())} style={goldBtn}>
          ← Quitter
        </button>
        <div />
      </div>

      {/* HEADER sticky */}
      <HeaderBlock
        currentPlayer={currentPlayer}
        currentAvatar={(currentPlayer && profileById[currentPlayer.id]?.avatarDataUrl) || null}
        currentRemaining={currentRemaining}
        currentThrow={currentThrow}
        doubleOut={doubleOut}
        multiplier={multiplier}
        setMultiplier={setMultiplier}
        start={start}
        scoresByPlayer={scoresByPlayer}
        statePlayers={(state.players || []) as EnginePlayer[]}
        liveRanking={liveRanking}
      />

      {/* Bloc joueurs (accordéon) */}
      <PlayersBlock
        playersOpen={playersOpen}
        setPlayersOpen={setPlayersOpen}
        statePlayers={(state.players || []) as EnginePlayer[]}
        profileById={profileById}
        lastByPlayer={lastByPlayer}
        lastBustByPlayer={lastBustByPlayer}
        dartsCount={dartsCount}
        pointsSum={pointsSum}
        start={start}
        scoresByPlayer={scoresByPlayer}
      />

      {/* Spacer keypad */}
      <div style={{ height: KEYPAD_HEIGHT + 8 }} />

      {/* Keypad FIXED */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: NAV_HEIGHT, zIndex: 45, padding: "0 12px 8px" }}>
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
      {pendingFirstWin && (
        <ContinueModal endNow={endNow} continueAfterFirst={continueAfterFirst} />
      )}

      {/* Overlay fin de manche */}
      <EndOfLegOverlay
        open={overlayOpen}
        result={lastLegResult as any} // enrichi potentiellement avec __legStats
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
              payload: res,
            } as any);
            (navigator as any).vibrate?.(50);
          } catch (e) {
            console.warn("Impossible de sauvegarder la manche:", e);
          }
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
  }) {
    const { currentPlayer, currentAvatar, currentRemaining, currentThrow, doubleOut } = props;
    const volleyTotal = currentThrow.reduce((s, d) => s + dartValue(d), 0);
    const predictedAfter = Math.max(currentRemaining - volleyTotal, 0);
    const dartsLeft = (3 - currentThrow.length) as 1 | 2 | 3;

    const curDarts = currentPlayer ? dartsCount[currentPlayer.id] || 0 : 0;
    const curPts = currentPlayer ? pointsSum[currentPlayer.id] || 0 : 0;
    const curM3D = curDarts > 0 ? ((curPts / curDarts) * 3).toFixed(2) : "0.00";

    return (
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background:
            "radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.10), transparent 55%), linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.8))",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 18,
          padding: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
          {/* Avatar agrandi */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              overflow: "hidden",
              background: "linear-gradient(180deg, #1b1b1f, #111114)",
              border: "1px solid rgba(255,255,255,.08)",
            }}
          >
            {currentAvatar ? (
              <img src={currentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

          {/* Centre : nom + score + volée + checkout */}
          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 24, color: "#ffcf57", letterSpacing: 0.4, marginBottom: 6 }}>
              {currentPlayer?.name ?? "—"}
            </div>

            <div
              style={{
                fontSize: 76,
                lineHeight: 1,
                fontWeight: 900,
                color: "#ffcf57",
                textShadow: "0 4px 20px rgba(255,195,26,.25)",
                letterSpacing: 0.5,
              }}
            >
              {Math.max(currentRemaining - currentThrow.reduce((s, d) => s + dartValue(d), 0), 0)}
            </div>

            {/* Pastilles volée */}
            <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center" }}>
              {[0, 1, 2].map((i: number) => {
                const d = currentThrow[i];
                const afterNow = currentRemaining - currentThrow.slice(0, i + 1).reduce((s, x) => s + dartValue(x), 0);
                const wouldBust = afterNow < 0 || (doubleOut && afterNow === 0 && !isDoubleFinish(currentThrow.slice(0, i + 1)));
                const st = chipStyle(d, wouldBust);
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 48,
                      height: 36,
                      padding: "0 14px",
                      borderRadius: 12,
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

            {/* Checkout centré */}
            {(() => {
              const only = suggestCheckout(predictedAfter, doubleOut, dartsLeft)[0];
              if (!only || currentThrow.length >= 3) return null;
              return (
                <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 10,
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,.08)",
                      background:
                        "radial-gradient(120% 120% at 50% 0%, rgba(255,195,26,.10), rgba(30,30,34,.95))",
                      boxShadow: "0 12px 28px rgba(0,0,0,.4)",
                      minWidth: 220,
                      maxWidth: 580,
                    }}
                  >
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,187,51,.4)",
                        background: "rgba(255,187,51,.12)",
                        color: "#ffc63a",
                        fontWeight: 900,
                        boxShadow: "0 0 18px rgba(255,195,26,.2)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {only}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Droite : mini stats & classement */}
          <div style={{ justifySelf: "end", alignSelf: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={miniCard}>
              <div style={miniTitle}>Stats</div>
              <div style={miniText}>
                <div>Score restant : <b>{currentRemaining}</b></div>
                <div>Darts jouées : <b>{curDarts}</b></div>
                <div>Moy/3D : <b>{curM3D}</b></div>
                <div>Volée en cours : <b>{Math.min(currentThrow.length, 3)}/3</b></div>
              </div>
            </div>

            <div style={{ ...miniCard, display: "flex", flexDirection: "column" }}>
              <div style={miniTitle}>Classement</div>
              <div style={{ overflow: "hidden", flex: 1 }}>
                {liveRanking.map((r, i) => (
                  <div key={r.id} style={miniRankRow}>
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
  }) {
    const {
      playersOpen,
      setPlayersOpen,
      statePlayers,
      profileById,
      lastByPlayer,
      lastBustByPlayer,
      dartsCount,
      pointsSum,
      start,
      scoresByPlayer,
    } = props;

    return (
      <div
        style={{
          background: "linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.85))",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 18,
          padding: 12,
          marginBottom: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,.35)",
        }}
      >
        <button
          onClick={() => setPlayersOpen(!playersOpen)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "transparent",
            color: "#e8e8ec",
            fontWeight: 800,
            fontSize: 16,
            border: "none",
            cursor: "pointer",
          }}
        >
          <span>Joueurs</span>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,.12)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transform: playersOpen ? "rotate(180deg)" : "none",
              transition: "transform .15s",
            }}
          >
            ▾
          </span>
        </button>

        {playersOpen && (
          <div style={{ marginTop: 10, maxHeight: "38vh", overflow: "auto", paddingRight: 4 }}>
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
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
                    border: "1px solid rgba(255,255,255,.07)",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "rgba(255,255,255,.06)",
                      flex: "0 0 auto",
                    }}
                  >
                    {avatarSrc ? (
                      <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#ffcf57" }}>{p.name}</div>
                      {last.length > 0 ? (
                        last.map((d, i) => {
                          const st = chipStyle(d, bust);
                          return (
                            <span
                              key={i}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: 38,
                                height: 26,
                                padding: "0 10px",
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
                        })
                      ) : (
                        <span style={{ color: "#aab" }}>Dernière volée : —</span>
                      )}
                    </div>

                    <div style={{ marginTop: 4, fontSize: 12, color: "#cfd1d7" }}>
                      Set 1 • Leg 1 • Darts: {dCount} • Moy/3D: {a3d}
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
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,.55)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 16,
        }}
      >
        <div
          style={{
            width: 460,
            background: "linear-gradient(180deg, #17181c, #101116)",
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h3 style={{ margin: "0 0 8px" }}>Continuer la manche ?</h3>
          <p style={{ opacity: 0.8, marginTop: 0 }}>
            Le premier joueur a terminé. Tu peux <b>terminer maintenant</b> (classement figé) ou <b>continuer</b> jusqu’à l’avant-dernier.
          </p>
          <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={endNow}
              style={{
                appearance: "none" as const,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.14)",
                background: "transparent",
                color: "#eee",
                cursor: "pointer",
              }}
            >
              Terminer maintenant
            </button>
            <button
              onClick={continueAfterFirst}
              style={{
                appearance: "none" as const,
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid transparent",
                background: "linear-gradient(180deg, #f0b12a, #c58d19)",
                color: "#141417",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 0 24px rgba(240,177,42,.25)",
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
          bottom: NAV_HEIGHT + KEYPAD_HEIGHT + 80,
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
}

/* ===== Styles mini-cards & ranking ===== */
const miniCard: React.CSSProperties = {
  width: "clamp(160px, 22vw, 190px)",
  height: 108,
  padding: 8,
  borderRadius: 12,
  background: "linear-gradient(180deg, rgba(22,22,26,.96), rgba(14,14,16,.98))",
  border: "1px solid rgba(255,255,255,.10)",
  boxShadow: "0 10px 22px rgba(0,0,0,.35)",
};
const miniTitle: React.CSSProperties = { fontWeight: 900, fontSize: 12, color: "#ffcf57", marginBottom: 4 };
const miniText: React.CSSProperties = { fontSize: 12, color: "#d9dbe3", lineHeight: 1.35 };
const miniRankRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "4px 6px",
  borderRadius: 6,
  background: "rgba(255,255,255,.04)",
  marginBottom: 4,
  fontSize: 11,
  lineHeight: 1.2,
};
const miniRankName: React.CSSProperties = { fontWeight: 700, color: "#ffcf57" };
const miniRankScore: React.CSSProperties = { fontWeight: 800, color: "#ffcf57" };
const miniRankScoreFini: React.CSSProperties = { fontWeight: 800, color: "#7fe2a9" };
