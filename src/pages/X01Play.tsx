// ============================================
// src/pages/X01Play.tsx
// Header sticky, Keypad fixed, Checkout centré sous la volée
// Sons (dart/bust), vibration, TTS (volée & fin de partie)
// Avatar agrandi, NOM centré au-dessus du score
// Mini-Stats (sans nom) + mini-Classement compacts (largeur adaptative)
// Bouton QUITTER doré
// + Reprise/sauvegarde Historique (History.upsert + resumeId)
// + CONTINUER jusqu’à l’avant-dernier + Overlay Classement/Stats de manche
// + Garde-fou: différer onFinish pour laisser voir le classement
// ============================================
import React from "react";
import { useX01Engine } from "../hooks/useX01Engine";
import Keypad from "../components/Keypad";
import EndOfLegOverlay from "../components/EndOfLegOverlay";
import type { Profile, MatchRecord, Dart as UIDart, LegResult, FinishPolicy } from "../lib/types";
import { History, makeX01RecordFromEngine } from "../lib/history";

/* ---- Constantes UI ---- */
const NAV_HEIGHT = 64;
const KEYPAD_HEIGHT = 360;

/* ---- Helpers ---- */
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

/* ---- Checkout suggestions (1 seule route, selon dartsLeft) ---- */
const SINGLE_SET = new Set<number>([...Array(20).keys()].map(n => n + 1).concat([25, 50]));

function suggestCheckout(rest: number, doubleOut: boolean, dartsLeft: 1 | 2 | 3): string[] {
  if (rest < 2 || rest > 170) return [];

  // 1 fléchette restante
  if (dartsLeft === 1) {
    if (doubleOut) {
      if (rest === 50) return ["DBULL"];
      if (rest % 2 === 0 && rest / 2 >= 1 && rest / 2 <= 20) return [`D${rest / 2}`];
      return [];
    } else {
      if (SINGLE_SET.has(rest)) {
        if (rest === 50) return ["BULL"];
        if (rest === 25) return ["25"];
        return [`S${rest}`];
      }
      return [];
    }
  }

  // Table standard (2-3 flèches) pour double-out
  const doubleMap: Record<number, string[]> = {
    170:["T20 T20 D25"],167:["T20 T19 D25"],164:["T20 T18 D25"],161:["T20 T17 D25"],160:["T20 T20 D20"],
    158:["T20 T20 D19"],157:["T20 T19 D20"],156:["T20 T20 D18"],155:["T20 T19 D19"],154:["T20 T18 D20"],
    153:["T20 T19 D18"],152:["T20 T20 D16"],151:["T20 T17 D20"],150:["T20 T18 D18","T20 T20 D15"],149:["T20 T19 D16"],
    148:["T20 T16 D20","T20 T20 D14"],147:["T20 T17 D18"],146:["T20 T18 D16"],145:["T20 T15 D20","T20 T19 D14"],
    144:["T20 T20 D12","T20 T16 D18"],143:["T20 T17 D16"],142:["T20 T14 D20","T20 T18 D14"],141:["T20 T19 D12"],
    140:["T20 T20 D10"],139:["T20 T13 D20","T20 T19 D11"],138:["T20 T18 D12"],137:["T20 T15 D16","T19 T16 D16"],
    136:["T20 T20 D8"],135:["T20 T17 D12","BULL T15 D20"],134:["T20 T14 D16","T20 T16 D13"],
    133:["T20 T19 D8","BULL T19 D13"],132:["T20 T16 D12","BULL T14 D20"],131:["T20 T13 D16","T19 T16 D14"],
    130:["T20 T18 D8","T20 20 D25"],129:["T19 T16 D12","19 T20 BULL"],128:["T18 T14 D16","T20 T16 D10"],
    127:["T20 T17 D8","T19 20 BULL"],126:["T19 T19 D6","T19 19 BULL"],125:["25 T20 D20","BULL 25 50"],
    124:["T20 T16 D8","T19 T19 D8"],123:["T19 T16 D9","T19 16 BULL"],122:["T18 T18 D7","T18 18 BULL"],
    121:["T20 11 D25","T19 14 D25"],120:["T20 20 D20"],119:["T19 10 D25","T19 12 D25"],118:["T20 18 D20","T20 10 D24"],
    117:["T20 17 D20","T19 20 D20"],116:["T20 16 D20","T19 19 D20"],115:["T20 15 D20","T19 18 D20"],114:["T20 14 D20","T19 17 D20"],
    113:["T20 13 D20","T19 16 D20"],112:["T20 12 D20","T20 20 D16"],111:["T20 11 D20","T19 14 D20"],110:["T20 10 D20","T20 18 D16"],
    109:["T20 9 D20"],108:["T20 16 D16"],107:["T19 18 D16","T20 15 D16"],106:["T20 14 D16"],105:["T20 13 D16","T19 16 D16"],
    104:["T18 18 D16"],103:["T20 11 D16"],102:["T20 10 D16"],101:["T20 9 D16"],100:["T20 D20"],99:["T19 10 D16"],
    98:["T20 D19"],97:["T19 D20"],96:["T20 D18"],95:["T19 D19"],94:["T18 D20"],93:["T19 D18"],92:["T20 D16"],91:["T17 D20"],
    90:["T18 D18","BULL D20"],89:["T19 D16"],88:["T16 D20"],87:["T17 D18"],86:["T18 D16"],85:["T15 D20"],84:["T16 D18"],
    83:["T17 D16"],82:["BULL D16"],81:["T15 D18"],80:["T20 D10","S20 D20"],79:["T19 D11"],78:["T18 D12"],77:["T19 D10"],
    76:["T20 D8"],75:["T17 D12"],74:["T14 D16"],73:["T19 D8"],72:["T16 D12"],71:["T13 D16"],70:["T20 D5","S20 D25"],
    69:["T19 D6"],68:["T20 D4"],67:["T17 D8"],66:["T10 D18"],65:["T11 D16"],64:["T16 D8"],63:["T13 D12"],62:["T10 D16"],
    61:["T15 D8"],60:["S20 D20"],58:["S18 D20"],57:["S17 D20"],56:["S16 D20"],55:["S15 D20"],54:["S14 D20"],
    53:["S13 D20"],52:["S12 D20"],51:["S11 D20"],50:["S10 D20","BULL"],49:["S9 D20"],
  };

  if (doubleOut) {
    const routes = (doubleMap[rest] ?? [])
      .filter(r => r.split(" ").length <= dartsLeft)
      .sort((a, b) => a.split(" ").length - b.split(" ").length);
    return routes.length ? [routes[0]] : [];
  }

  // simple-out (2 ou 3 flèches)
  const res: string[] = [];
  const push = (s: string) => res.push(s);

  if (rest <= 50 && SINGLE_SET.has(rest)) push(rest === 50 ? "BULL" : rest === 25 ? "25" : `S${rest}`);

  const tryTwo = (label: string, pts: number) => {
    const r = rest - pts;
    if (SINGLE_SET.has(r)) push(`${label} S${r}`);
  };
  tryTwo("T20", 60); tryTwo("T19", 57); tryTwo("T18", 54); tryTwo("50", 50); tryTwo("25", 25);

  for (let a = 1; a <= 50; a++) {
    if (!SINGLE_SET.has(a)) continue;
    const b = rest - a;
    if (SINGLE_SET.has(b)) { push(`S${a} S${b}`); break; }
  }

  const tryThree = (l1: string, s1: number, l2: string, s2: number) => {
    const r = rest - s1 - s2;
    if (SINGLE_SET.has(r)) push(`${l1} ${l2} S${r}`);
  };
  tryThree("T20", 60, "T20", 60); tryThree("T20", 60, "T19", 57); tryThree("T20", 60, "T18", 54);
  tryThree("50", 50, "T20", 60); tryThree("50", 50, "T19", 57); tryThree("50", 50, "T18", 54);
  tryThree("25", 25, "T20", 60); tryThree("25", 25, "T19", 57); tryThree("25", 25, "T18", 54);

  const filtered = res.filter(r => r.split(" ").length <= dartsLeft)
                      .sort((a, b) => a.split(" ").length - b.split(" ").length);
  return filtered.length ? [filtered[0]] : [];
}

/* --------- Composant --------- */
export default function X01Play({
  profiles = [], playerIds = [], start = 501, doubleOut = true, onFinish, onExit, params,
}: {
  profiles?: Profile[]; playerIds?: string[]; start?: 301 | 501 | 701 | 1001; doubleOut?: boolean;
  onFinish: (m: MatchRecord) => void; onExit: () => void;
  params?: { resumeId?: string } | any;
}) {
  const resumeId: string | undefined = params?.resumeId;

  // Essaie de charger un snapshot si on vient de l’historique
  const savedRecord = React.useMemo(() => resumeId ? History.get(resumeId) : undefined, [resumeId]);
  const resumeSnapshot = savedRecord?.kind === "x01" ? savedRecord.payload?.state : undefined;

  // ====== Nouvel état overlay de manche
  const [lastLegResult, setLastLegResult] = React.useState<LegResult | null>(null);
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  // ====== NEW: onFinish différé (empêche navigation auto)
  const [pendingFinish, setPendingFinish] = React.useState<MatchRecord | null>(null);

  // Option par défaut pour le comportement "CONTINUER"
  const defaultFinishPolicy: FinishPolicy =
    ((safeGetLocalStorage("opt_continue_policy") ?? "firstToZero") as FinishPolicy);

  // Hook moteur (avec champs CONTINUER)
  const {
    state,
    currentPlayer,
    turnIndex,
    scoresByPlayer,
    isOver,
    winner,
    submitThrowUI,
    undoLast,
    // ↓ ajouts du hook modifié
    pendingFirstWin,
    continueAfterFirst,
    endNow,
    isContinuing,
  } = useX01Engine({
    profiles,
    playerIds,
    start,
    doubleOut,
    // Interception d'onFinish pour ne pas naviguer immédiatement
    onFinish: (m) => {
      if (overlayOpen || pendingFinish) {
        setPendingFinish(m);
      } else {
        onFinish(m);
      }
    },
    // @ts-ignore — si la signature du hook n’a pas "resume", il ignorera
    resume: resumeSnapshot,
    finishPolicy: defaultFinishPolicy,
    onLegEnd: (res) => {
      setLastLegResult(res);
      setOverlayOpen(true);
    },
  });

  // Déclenche la navigation lorsqu’on décide de terminer
  const flushPendingFinish = React.useCallback(() => {
    if (pendingFinish) {
      const m = pendingFinish;
      setPendingFinish(null);
      setOverlayOpen(false);
      onFinish(m);
      return;
    }
    // fallback: fabrique un record final si rien n’est en attente
    const rec = makeX01RecordFromEngine({
      engine: buildEngineLike([], winner?.id ?? null),
      existingId: historyIdRef.current,
    });
    History.upsert(rec);
    historyIdRef.current = rec.id;
    onFinish(rec);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFinish, onFinish, winner?.id]);

  // Référence vers l'id d'historique courant (pour upsert au même ID)
  const historyIdRef = React.useRef<string | undefined>(resumeId ?? savedRecord?.id);

  const [currentThrow, setCurrentThrow] = React.useState<UIDart[]>([]);
  const [multiplier, setMultiplier] = React.useState<1 | 2 | 3>(1);
  const [playersOpen, setPlayersOpen] = React.useState(true);
  const [showRanking, setShowRanking] = React.useState(false);

  // dernières volées + BUST
  const [lastByPlayer, setLastByPlayer] = React.useState<Record<string, UIDart[]>>({});
  const [lastBustByPlayer, setLastBustByPlayer] = React.useState<Record<string, boolean>>({});

  // stats live
  const [dartsCount, setDartsCount] = React.useState<Record<string, number>>({});
  const [pointsSum, setPointsSum] = React.useState<Record<string, number>>({});

  /* Sounds & TTS */
  const dartHit  = React.useMemo(() => createAudio(["/sounds/dart-hit.mp3", "/sounds/dart-hit.ogg"]), []);
  const bustSnd  = React.useMemo(() => createAudio(["/sounds/bust.mp3", "/sounds/bust.ogg"]), []);
  const voiceOn  = React.useMemo<boolean>(() => (safeGetLocalStorage("opt_voice") ?? "true") === "true", []);

  /* Current / remaining */
  const profileById = React.useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of profiles) map[p.id] = p;
    return map;
  }, [profiles]);

  const currentRemaining = scoresByPlayer[currentPlayer?.id || ""] ?? start;
  const volleyTotal = currentThrow.reduce((s, d) => s + dartValue(d), 0);
  const predictedAfter = Math.max(currentRemaining - volleyTotal, 0);

  /* Handlers entrée */
  function handleNumber(n: number) {
    if (currentThrow.length >= 3) return;
    setCurrentThrow(t => [...t, { v: n, mult: n === 0 ? 1 : multiplier }]);
    setMultiplier(1);
    try { dartHit.currentTime = 0; dartHit.play(); } catch {}
    (navigator as any).vibrate?.(25);
  }
  function handleBull() {
    if (currentThrow.length >= 3) return;
    setCurrentThrow(t => [...t, { v: 25, mult: multiplier === 2 ? 2 : 1 }]);
    setMultiplier(1);
    try { dartHit.currentTime = 0; dartHit.play(); } catch {}
    (navigator as any).vibrate?.(25);
  }

  /** Construit un "engine-like" minimal pour l'API makeX01RecordFromEngine */
  function buildEngineLike(dartsThisTurn: UIDart[], winnerId?: string | null) {
    const playersArr = (state.players || []).map((p: any) => ({ id: p.id, name: p.name }));
    const scores: number[] = playersArr.map(p => scoresByPlayer[p.id] ?? start);
    const idx = playersArr.findIndex(p => p.id === currentPlayer?.id);
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

  /** Sauvegarde "in progress" après chaque validation de volée */
  function persistAfterThrow(dartsJustThrown: UIDart[]) {
    const rec = makeX01RecordFromEngine({
      engine: buildEngineLike(dartsJustThrown, null),
      existingId: historyIdRef.current,
    });
    History.upsert(rec);
    historyIdRef.current = rec.id;
  }

  /** Sauvegarde "finished" quand la partie se termine */
  function persistOnFinish() {
    const rec = makeX01RecordFromEngine({
      engine: buildEngineLike([], winner?.id ?? null),
      existingId: historyIdRef.current,
    });
    History.upsert(rec);
    historyIdRef.current = rec.id;
  }

  function validateThrow() {
    if (!currentThrow.length || !currentPlayer) return;

    const volleyPts = currentThrow.reduce((s, d) => s + dartValue(d), 0);
    const after = currentRemaining - volleyPts;
    let willBust = after < 0;
    if (!willBust && doubleOut && after === 0) willBust = !isDoubleFinish(currentThrow);

    const ptsForStats = willBust ? 0 : volleyPts;
    setDartsCount((m) => ({ ...m, [currentPlayer.id]: (m[currentPlayer.id] || 0) + currentThrow.length }));
    setPointsSum((m)  => ({ ...m, [currentPlayer.id]: (m[currentPlayer.id] || 0) + ptsForStats }));

    // Sauvegarde avant reset (inclure la volée jouée)
    persistAfterThrow(currentThrow);

    // Envoi au moteur
    submitThrowUI(currentThrow);

    setLastByPlayer((m) => ({ ...m, [currentPlayer.id]: currentThrow }));
    setLastBustByPlayer((m) => ({ ...m, [currentPlayer.id]: !!willBust }));

    if (willBust) {
      try { bustSnd.currentTime = 0; bustSnd.play(); } catch {}
      (navigator as any).vibrate?.([120,60,140]);
    } else if (voiceOn && "speechSynthesis" in window) {
      const name = currentPlayer.name || "";
      const ptsLabel = volleyPts === 1 ? "point" : "points";
      const u = new SpeechSynthesisUtterance(`${name}, ${volleyPts} ${ptsLabel}`);
      u.rate = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }

    setCurrentThrow([]); setMultiplier(1);
  }
  function handleBackspace() { setCurrentThrow(t => t.slice(0, -1)); }
  function handleCancel()    { if (currentThrow.length) setCurrentThrow(t => t.slice(0, -1)); else undoLast?.(); }
  function handleDouble()    { setMultiplier(2); }
  function handleTriple()    { setMultiplier(3); }
  function handleSimple()    { setMultiplier(1); }

  /* Classement live */
  const liveRanking = React.useMemo(() => {
    const items = (state.players || []).map((p: any) => ({ id: p.id, name: p.name, score: scoresByPlayer[p.id] ?? start }));
    items.sort((a, b) => {
      const az = a.score === 0, bz = b.score === 0;
      if (az && !bz) return -1; if (!az && bz) return 1;
      return a.score - b.score;
    });
    return items;
  }, [state.players, scoresByPlayer, start]);

  function chipStyle(d?: UIDart, red = false): React.CSSProperties {
    if (!d) return { background: "rgba(255,255,255,.06)", color: "#bbb", border: "1px solid rgba(255,255,255,.08)" };
    if (red) return { background: "rgba(200,30,30,.18)", color: "#ff8a8a", border: "1px solid rgba(255,80,80,.35)" };
    if (d.v === 25 && d.mult === 2) return { background: "rgba(13,160,98,.18)", color: "#8ee6bf", border: "1px solid rgba(13,160,98,.35)" };
    if (d.v === 25) return { background: "rgba(13,160,98,.12)", color: "#7bd6b0", border: "1px solid rgba(13,160,98,.3)" };
    if (d.mult === 3) return { background: "rgba(179,68,151,.18)", color: "#ffd0ff", border: "1px solid rgba(179,68,151,.35)" };
    if (d.mult === 2) return { background: "rgba(46,150,193,.18)", color: "#cfeaff", border: "1px solid rgba(46,150,193,.35)" };
    return { background: "rgba(255,187,51,.12)", color: "#ffc63a", border: "1px solid rgba(255,187,51,.4)" };
  }

  /* UI — styles utilitaires */
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

  /* Guard */
  if (!state.players?.length) {
    return (
      <div className="container" style={{ padding: 16 }}>
        <button onClick={() => (pendingFinish ? flushPendingFinish() : onExit())} style={goldBtn}>← Quitter</button>
        <p>Aucun joueur sélectionné. Reviens au lobby.</p>
      </div>
    );
  }

  const currentAvatar =
    (currentPlayer && (profileById[currentPlayer.id]?.avatarDataUrl as string | null)) ?? null;

  const curDarts = currentPlayer ? (dartsCount[currentPlayer.id] || 0) : 0;
  const curPts   = currentPlayer ? (pointsSum[currentPlayer.id] || 0)   : 0;
  const curM3D   = curDarts > 0 ? ((curPts / curDarts) * 3).toFixed(2) : "0.00";

  // === TTS FIN DE PARTIE + sauvegarde finale ===
const prevIsOver = React.useRef(false);
React.useEffect(() => {
  const justFinished = !prevIsOver.current && isOver;
  prevIsOver.current = isOver;

  if (justFinished) {
    persistOnFinish();
  }

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
  for (let i = 1; i < ordered.length && i < 8; i++) {
    parts.push(`${ords[i]} ${ordered[i].name}`);
  }

  const text: string = parts.join(". ") + ".";
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}, [isOver, liveRanking, voiceOn, winner?.id]);

// nombre de fléchettes restantes pour le rendu du checkout
const dartsLeft = (3 - currentThrow.length) as 1 | 2 | 3;

// bandeau fin de partie visible seulement si pas en “continuer”/modale
const showEndBanner = isOver && !pendingFirstWin && !isContinuing;

  return (
    <div className="x01play-container" style={{ paddingBottom: KEYPAD_HEIGHT + NAV_HEIGHT + 16 }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={() => (pendingFinish ? flushPendingFinish() : onExit())} style={goldBtn}>← Quitter</button>
        <div />
      </div>

      {/* Header STICKY */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "radial-gradient(120% 140% at 0% 0%, rgba(255,195,26,.10), transparent 55%), linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.8))",
        border: "1px solid rgba(255,255,255,.08)", borderRadius: 18, padding: 14, boxShadow: "0 10px 30px rgba(0,0,0,.35)", marginBottom: 12,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
          {/* Avatar agrandi */}
          <div style={{ width: 120, height: 120, borderRadius: "50%", overflow: "hidden", background: "linear-gradient(180deg, #1b1b1f, #111114)", border: "1px solid rgba(255,255,255,.08)" }}>
            {currentAvatar
              ? <img src={currentAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontWeight: 700 }}>?</div>
            }
          </div>

          {/* Centre : NOM + SCORE + volée + CHECKOUT */}
          <div style={{ textAlign: "center", minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 24, color: "#ffcf57", letterSpacing: .4, marginBottom: 6 }}>
              {currentPlayer?.name ?? "—"}
            </div>

            <div style={{ fontSize: 76, lineHeight: 1, fontWeight: 900, color: "#ffcf57", textShadow: "0 4px 20px rgba(255,195,26,.25)", letterSpacing: 0.5 }}>
              {predictedAfter}
            </div>

            {/* Pastilles volée */}
            <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center" }}>
              {[0,1,2].map((i) => {
                const d = currentThrow[i];
                const afterNow = currentRemaining - currentThrow.slice(0, i + 1).reduce((s, x) => s + dartValue(x), 0);
                const wouldBust = afterNow < 0 || (doubleOut && afterNow === 0 && !isDoubleFinish(currentThrow.slice(0, i + 1)));
                const st = chipStyle(d, wouldBust);
                return (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    minWidth: 48, height: 36, padding: "0 14px", borderRadius: 12,
                    border: st.border as string, background: st.background as string, color: st.color as string, fontWeight: 800,
                  }}>
                    {fmt(d)}
                  </span>
                );
              })}
            </div>

            {/* CHECKOUT centré sous la volée — 1 seule proposition */}
            {(() => {
              const only = suggestCheckout(predictedAfter, doubleOut, dartsLeft)[0];
              if (!only || currentThrow.length >= 3) return null;
              return (
                <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: 10, borderRadius: 14, border: "1px solid rgba(255,255,255,.08)",
                    background: "radial-gradient(120% 120% at 50% 0%, rgba(255,195,26,.10), rgba(30,30,34,.95))",
                    boxShadow: "0 12px 28px rgba(0,0,0,.4)", minWidth: 220, maxWidth: 580,
                  }}>
                    <span style={{
                      padding: "6px 10px", borderRadius: 10,
                      border: "1px solid rgba(255,187,51,.4)", background: "rgba(255,187,51,.12)",
                      color: "#ffc63a", fontWeight: 900, boxShadow: "0 0 18px rgba(255,195,26,.2)", whiteSpace: "nowrap",
                    }}>
                      {only}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Droite : mini-Stats + mini-Classement compacts */}
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

      {/* Bloc Joueurs (déroulant) */}
      <div style={{
        background: "linear-gradient(180deg, rgba(15,15,18,.9), rgba(10,10,12,.85))",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 18, padding: 12, marginBottom: 12, boxShadow: "0 10px 30px rgba(0,0,0,.35)",
      }}>
        <button
          onClick={() => setPlayersOpen(v => !v)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "transparent", color: "#e8e8ec", fontWeight: 800, fontSize: 16, border: "none", cursor: "pointer"
          }}
        >
          <span>Joueurs</span>
          <span style={{
            width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,.12)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            transform: playersOpen ? "rotate(180deg)" : "none", transition: "transform .15s",
          }}>▾</span>
        </button>

        {playersOpen && (
          <div style={{ marginTop: 10, maxHeight: "38vh", overflow: "auto", paddingRight: 4 }}>
            {(state.players || []).map((p: any) => {
              const prof = profileById[p.id];
              const avatarSrc =
                (prof?.avatarDataUrl as string | null) ?? null;
              const last = lastByPlayer[p.id] || [];
              const bust = !!lastBustByPlayer[p.id];

              const dCount = dartsCount[p.id] || 0;
              const pSum   = pointsSum[p.id] || 0;
              const a3d    = dCount > 0 ? ((pSum / dCount) * 3).toFixed(2) : "0.00";

              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 12,
                  background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
                  border: "1px solid rgba(255,255,255,.07)", marginBottom: 8,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,.06)", flex: "0 0 auto" }}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontWeight: 700 }}>?</div>
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 800, color: "#ffcf57" }}>{p.name}</div>
                      {last.length > 0 ? last.map((d, i) => {
                        const st = chipStyle(d, bust);
                        return (
                          <span key={i} style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            minWidth: 38, height: 26, padding: "0 10px", borderRadius: 10,
                            border: st.border as string, background: st.background as string, color: st.color as string, fontWeight: 800,
                          }}>
                            {fmt(d)}
                          </span>
                        );
                      }) : <span style={{ color: "#aab" }}>Dernière volée : —</span>}
                    </div>

                    <div style={{ marginTop: 4, fontSize: 12, color: "#cfd1d7" }}>
                      Set 1 • Leg 1 • Darts: {dCount} • Moy/3D: {a3d}
                    </div>
                  </div>

                  <div style={{ fontWeight: 900, color: scoresByPlayer[p.id] === 0 ? "#7fe2a9" : "#ffcf57" }}>
                    {scoresByPlayer[p.id] ?? start}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Espace sous le keypad */}
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

      {/* ===== Modale "CONTINUER ?" déclenchée au premier checkout ===== */}
      {pendingFirstWin && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
            backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000, padding: 16,
          }}
        >
          <div
            style={{
              width: 460, background: "linear-gradient(180deg, #17181c, #101116)",
              border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: 18
            }}
          >
            <h3 style={{ margin: "0 0 8px" }}>Continuer la manche ?</h3>
            <p style={{ opacity: .8, marginTop: 0 }}>
              Le premier joueur a terminé. Tu peux <b>terminer maintenant</b> (classement figé)
              ou <b>continuer</b> jusqu’à ce que l’avant-dernier finisse.
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={endNow}
                style={{ appearance: "none", padding: "10px 14px", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.14)", background: "transparent", color: "#eee", cursor: "pointer" }}
              >
                Terminer maintenant
              </button>
              <button
                onClick={continueAfterFirst}
                style={{ appearance: "none", padding: "10px 14px", borderRadius: 12,
                  border: "1px solid transparent", background: "linear-gradient(180deg, #f0b12a, #c58d19)",
                  color: "#141417", fontWeight: 700, cursor: "pointer", boxShadow: "0 0 24px rgba(240,177,42,.25)" }}
              >
                CONTINUER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Overlay fin de manche (classement + stats) ===== */}
      <EndOfLegOverlay
        open={overlayOpen}
        result={lastLegResult}
        playersById={React.useMemo(
          () => Object.fromEntries((state.players || []).map((p: any) => {
            const prof = profileById[p.id];
            return [p.id, { id: p.id, name: p.name, avatarDataUrl: prof?.avatarDataUrl }];
          })),
          [state.players, profileById]
        )}
        onClose={() => setOverlayOpen(false)}
        onReplay={() => {
          setOverlayOpen(false);
        }}
      />

      {/* Bandeau fin de partie (match terminé) */}
      {showEndBanner && (
        <div style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)",
          bottom: NAV_HEIGHT + KEYPAD_HEIGHT + 80, zIndex: 47,
          background: "linear-gradient(180deg, #ffc63a, #ffaf00)", color: "#1a1a1a",
          fontWeight: 900, textAlign: "center", padding: 12, borderRadius: 12, boxShadow: "0 10px 28px rgba(0,0,0,.35)",
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <span>Victoire : {winner?.name || "—"}</span>
          <button onClick={continueAfterFirst} style={goldBtn}>Continuer (laisser finir)</button>
          <button onClick={() => setOverlayOpen(true)} style={goldBtn}>Classement</button>
          <button onClick={flushPendingFinish} style={goldBtn}>Terminer</button>
        </div>
      )}
    </div>
  );
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
const miniText: React.CSSProperties  = { fontSize: 12, color: "#d9dbe3", lineHeight: 1.35 };

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
