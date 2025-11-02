// ============================================
// src/pages/X01Setup.tsx
// Paramètres X01 (pré-match) + Couronne d’étoiles autour des avatars
// ============================================
import React from "react";
import type { Profile } from "../lib/types";
import ProfileStarRing from "../components/ProfileStarRing";
import { getBasicProfileStats, type BasicProfileStats } from "../lib/statsBridge";

type SetupProps = {
  profiles: Profile[];
  onCancel: () => void;
  onStart: (opts: {
    playerIds: string[];
    start: 301 | 501 | 701 | 901;
    outMode: "simple" | "double" | "master";
    inMode: "simple" | "double" | "master";
    doubleOut: boolean;
    doubleIn: boolean;
    setsToWin: number;   // 1/3/5/7/9/11/13
    legsPerSet: number;  // 1/3/5/7
    randomOrder: boolean;
  }) => void;
};

const SCORE_CHOICES: Array<301 | 501 | 701 | 901> = [301, 501, 701, 901];
const SET_CHOICES = [1, 3, 5, 7, 9, 11, 13] as const;
const LEG_CHOICES = [1, 3, 5, 7] as const;

type SavedSettings = Partial<{
  start: 301 | 501 | 701 | 901;
  outMode: "simple" | "double" | "master";
  inMode: "simple" | "double" | "master";
  setsToWin: number;
  legsPerSet: number;
  randomOrder: boolean;
  officialMatch: boolean; // 👈 serve alterné
  voiceOn: boolean;       // 👈 TTS
  sfxOn: boolean;         // 👈 sons arcade
}>;

function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem("settings_x01");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveSettings(s: SavedSettings) {
  try {
    localStorage.setItem("settings_x01", JSON.stringify(s));
  } catch {}
}

function pill(on: boolean): React.CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 999,
    fontWeight: 800,
    border: "1px solid " + (on ? "rgba(255,200,80,.45)" : "rgba(255,255,255,.12)"),
    background: on
      ? "linear-gradient(180deg, #ffc63a, #ffaf00)"
      : "linear-gradient(180deg, rgba(24,24,28,.7), rgba(18,18,22,.7))",
    color: on ? "#1a1a1a" : "#e9e9ef",
    cursor: "pointer",
    boxShadow: on ? "0 8px 24px rgba(255,180,0,.28)" : "none",
  };
}

const card: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(16,16,20,.9), rgba(10,10,12,.85))",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 16,
  padding: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,.35)",
};

const title: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  background: "linear-gradient(180deg, #ffc63a, #ffaf00)",
  color: "#151517",
  fontWeight: 900,
  letterSpacing: 0.4,
  display: "inline-block",
};

const sub: React.CSSProperties = { color: "#cfd1d7", fontSize: 12 };

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Charge un map {profileId -> BasicProfileStats} pour afficher les rings */
function useAvgMap(profiles: Profile[]) {
  const [map, setMap] = React.useState<Record<string, BasicProfileStats | undefined>>({});
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      // On charge progressivement pour éviter un burst.
      for (const p of profiles) {
        if (cancel || map[p.id]) continue;
        try {
          const s = await getBasicProfileStats(p.id);
          if (!cancel) setMap((m) => (m[p.id] ? m : { ...m, [p.id]: s }));
        } catch { /* ignore */ }
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.map(p => p.id).join("|")]);
  return map;
}

export default function X01Setup({ profiles, onCancel, onStart }: SetupProps) {
  const saved = React.useMemo(loadSettings, []);
  const [start, setStart] = React.useState<301 | 501 | 701 | 901>(saved.start ?? 501);
  const [outMode, setOutMode] = React.useState<"simple" | "double" | "master">(saved.outMode ?? "double");
  const [inMode, setInMode] = React.useState<"simple" | "double" | "master">(saved.inMode ?? "simple");
  const [setsToWin, setSetsToWin] = React.useState<number>(saved.setsToWin ?? 1);
  const [legsPerSet, setLegsPerSet] = React.useState<number>(saved.legsPerSet ?? 1);
  const [randomOrder, setRandomOrder] = React.useState<boolean>(saved.randomOrder ?? false);

  // nouvelles options persistées
  const [officialMatch, setOfficialMatch] = React.useState<boolean>(saved.officialMatch ?? false);
  const [voiceOn, setVoiceOn] = React.useState<boolean>(saved.voiceOn ?? true);
  const [sfxOn, setSfxOn] = React.useState<boolean>(saved.sfxOn ?? true);

  const [available, setAvailable] = React.useState<Profile[]>(() => profiles.slice());
  const [selected, setSelected] = React.useState<Profile[]>([]);

  // Map des stats pour les rings (disponibles + sélectionnés)
  const avgMap = useAvgMap([...available, ...selected]);

  React.useEffect(() => {
    saveSettings({
      start, outMode, inMode, setsToWin, legsPerSet, randomOrder,
      officialMatch, voiceOn, sfxOn,
    });
  }, [start, outMode, inMode, setsToWin, legsPerSet, randomOrder, officialMatch, voiceOn, sfxOn]);

  function addPlayer(p: Profile) {
    setAvailable((a) => a.filter((x) => x.id !== p.id));
    setSelected((s) => [...s, p]);
  }
  function removePlayer(p: Profile) {
    setSelected((s) => s.filter((x) => x.id !== p.id));
    setAvailable((a) => [...a, p]);
  }

  function handleStart() {
    if (!selected.length) return;
    const order = randomOrder ? shuffle(selected) : selected.slice();
    const doubleOut = outMode !== "simple";
    const doubleIn  = inMode  !== "simple";

    const payloadForPlay = {
      playerIds: order.map((p) => p.id),
      start, outMode, inMode, doubleOut, doubleIn,
      setsToWin, legsPerSet, randomOrder,
      officialMatch,
      finishPolicy: "firstToZero" as const,
      audio: { voiceOn, sfxOn },
    };
    (window as any).__x01StartParams = payloadForPlay;

    onStart({
      playerIds: payloadForPlay.playerIds,
      start, outMode, inMode, doubleOut, doubleIn,
      setsToWin, legsPerSet, randomOrder,
    });
  }

  // -------------------- Rendu --------------------
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 12 }}>
      {/* Bandeau titre + Quitter */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={title}>Paramètres X01</span>
        <button
          onClick={onCancel}
          style={{
            padding: "6px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,180,0,.3)",
            background: "linear-gradient(180deg, #ffc63a, #ffaf00)",
            color: "#1a1a1a",
            fontWeight: 900,
            boxShadow: "0 10px 22px rgba(255,170,0,.28)",
            cursor: "pointer",
          }}
        >
          ← Annuler
        </button>
      </div>

      {/* Score + modes */}
      <div style={{ ...card, marginBottom: 10 }}>
        <div style={{ fontWeight: 900, color: "#ffcf57", marginBottom: 8 }}>Score de départ</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {SCORE_CHOICES.map((s) => (
            <button key={s} onClick={() => setStart(s)} style={pill(start === s)}>{s}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ ...card }}>
            <div style={{ fontWeight: 900, color: "#ffcf57", marginBottom: 8 }}>Mode de sortie</div>
            <select value={outMode} onChange={(e) => setOutMode(e.target.value as any)} style={selectStyle}>
              <option value="simple">Simple</option>
              <option value="double">Double</option>
              <option value="master">Master (Triple)</option>
            </select>
          </div>

          <div style={{ ...card }}>
            <div style={{ fontWeight: 900, color: "#ffcf57", marginBottom: 8 }}>Mode d’entrée</div>
            <select value={inMode} onChange={(e) => setInMode(e.target.value as any)} style={selectStyle}>
              <option value="simple">Simple</option>
              <option value="double">Double</option>
              <option value="master">Master (Triple)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Format du match */}
      <div style={{ ...card, marginBottom: 10 }}>
        <div style={{ fontWeight: 900, color: "#ffcf57", marginBottom: 8 }}>Format du match</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ ...card }}>
            <div style={{ fontWeight: 800, marginBottom: 6, color: "#e9e9ef" }}>Sets à gagner</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SET_CHOICES.map((n) => (
                <button key={n} onClick={() => setSetsToWin(n)} style={pill(setsToWin === n)}>{n}</button>
              ))}
            </div>
            <div style={{ ...sub, marginTop: 6 }}>1 = pas de sets (match en un seul set)</div>
          </div>

          <div style={{ ...card }}>
            <div style={{ fontWeight: 800, marginBottom: 6, color: "#e9e9ef" }}>Legs à gagner (par set)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {LEG_CHOICES.map((n) => (
                <button key={n} onClick={() => setLegsPerSet(n)} style={pill(legsPerSet === n)}>{n}</button>
              ))}
            </div>
            <div style={{ ...sub, marginTop: 6 }}>1 = pas de best-of dans un set</div>
          </div>
        </div>

        {/* Options */}
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={checkLabel}>
            <input type="checkbox" checked={randomOrder} onChange={(e) => setRandomOrder(e.target.checked)} />
            <span>Ordre aléatoire au lancement</span>
          </label>

          <label style={checkLabel}>
            <input type="checkbox" checked={officialMatch} onChange={(e) => setOfficialMatch(e.target.checked)} />
            <span>Mode match officiel (serve alterné)</span>
          </label>

          <label style={checkLabel}>
            <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
            <span>Voix (TTS)</span>
          </label>

          <label style={checkLabel}>
            <input type="checkbox" checked={sfxOn} onChange={(e) => setSfxOn(e.target.checked)} />
            <span>Sons arcade</span>
          </label>
        </div>

        <div style={{ ...sub, marginTop: 8 }}>
          Astuce : <b>Legs</b> = manches dans un set. <b>Sets</b> = séries de legs.
          L’affichage in-game est <b>Set i/N</b> et <b>Leg j/N</b>.
        </div>
      </div>

      {/* Boutons + Joueurs sélectionnés */}
      <div style={{ ...card, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.14)",
              background: "transparent",
              color: "#eee",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleStart}
            disabled={!selected.length}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid transparent",
              background: selected.length
                ? "linear-gradient(180deg, #2ed573, #18c66b)"
                : "linear-gradient(180deg, #3a3a3e, #333338)",
              color: selected.length ? "#141417" : "#9a9aa0",
              fontWeight: 900,
              cursor: selected.length ? "pointer" : "not-allowed",
              boxShadow: selected.length ? "0 0 24px rgba(30,220,120,.25)" : "none",
            }}
          >
            Lancer la partie
          </button>
        </div>

        <div style={{ fontWeight: 900, color: "#ffcf57", marginBottom: 8 }}>Joueurs sélectionnés</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
            gap: 10,
            marginBottom: 12,
            minHeight: 56,
          }}
        >
          {selected.map((p) => {
            const AVA = 56;         // diamètre avatar sélectionné
            const STAR = 9;         // taille des étoiles
            const PAD = 6;          // respiration externe
            const avg3 = avgMap[p.id]?.avg3 ?? 0;
            return (
              <div key={p.id} style={{ textAlign: "center" }}>
                {/* Wrapper non-clipant pour le RING */}
                <div style={{ position: "relative", width: AVA, height: AVA, margin: "0 auto" }}>
                  {/* Couronne EXTERNE (en dehors du disque clipé) */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: -(PAD + STAR / 2),
                      top:  -(PAD + STAR / 2),
                      width:  AVA + (PAD + STAR / 2) * 2,
                      height: AVA + (PAD + STAR / 2) * 2,
                      pointerEvents: "none",
                      overflow: "visible",
                    }}
                  >
                    <ProfileStarRing
                      anchorSize={AVA}
                      gapPx={6}           // ⭐ positif => autour du bord
                      starSize={STAR}
                      stepDeg={10}
                      rotationDeg={0}
                      avg3d={avg3}
                    />
                  </div>

                  {/* Médaillon clipé */}
                  <div
                    title={p.name}
                    onClick={() => removePlayer(p)}
                    style={{
                      width: AVA,
                      height: AVA,
                      borderRadius: "50%",
                      overflow: "hidden",            // clip seulement l’image
                      border: "2px solid rgba(255,200,80,.45)",
                      boxShadow: "0 6px 18px rgba(255,195,26,.2)",
                      cursor: "pointer",
                      background: "rgba(255,255,255,.06)",
                    }}
                  >
                    {p.avatarDataUrl ? (
                      <img src={p.avatarDataUrl as string} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontWeight: 800 }}>?</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!selected.length && <div style={{ color: "#aab", fontSize: 12 }}>Aucun joueur sélectionné</div>}
        </div>

        {/* Joueurs disponibles */}
        <div style={{ fontWeight: 900, color: "#ffcf57", marginBottom: 8 }}>Joueurs disponibles</div>
        <div>
          {available.map((p) => {
            const AVA = 38;    // avatar liste
            const STAR = 8;
            const PAD = 6;
            const avg3 = avgMap[p.id]?.avg3 ?? 0;
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "linear-gradient(180deg, rgba(28,28,32,.65), rgba(18,18,20,.65))",
                  border: "1px solid rgba(255,255,255,.07)",
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Wrapper non-clipant */}
                  <div style={{ position: "relative", width: AVA, height: AVA, flex: "0 0 auto" }}>
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: -(PAD + STAR / 2),
                        top:  -(PAD + STAR / 2),
                        width:  AVA + (PAD + STAR / 2) * 2,
                        height: AVA + (PAD + STAR / 2) * 2,
                        pointerEvents: "none",
                        overflow: "visible",
                      }}
                    >
                      <ProfileStarRing
                        anchorSize={AVA}
                        gapPx={6}
                        starSize={STAR}
                        stepDeg={10}
                        rotationDeg={0}
                        avg3d={avg3}
                      />
                    </div>

                    {/* Médaillon clipé */}
                    <div
                      style={{
                        width: AVA,
                        height: AVA,
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: "rgba(255,255,255,.06)",
                      }}
                    >
                      {p.avatarDataUrl ? (
                        <img src={p.avatarDataUrl as string} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", fontWeight: 700, fontSize: 12 }}>?</div>
                      )}
                    </div>
                  </div>

                  <div style={{ fontWeight: 800, color: "#ffcf57" }}>{p.name}</div>
                </div>

                <button
                  onClick={() => addPlayer(p)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,200,80,.35)",
                    background: "transparent",
                    color: "#ffcf57",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Ajouter
                </button>
              </div>
            );
          })}
          {!available.length && <div style={{ color: "#aab", fontSize: 12 }}>Tous les joueurs sont sélectionnés</div>}
        </div>
      </div>
    </div>
  );
}

/* --- Styles partagés --- */
const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  background: "linear-gradient(180deg, rgba(24,24,28,.7), rgba(18,18,22,.7))",
  border: "1px solid rgba(255,255,255,.12)",
  color: "#e9e9ef",
  fontWeight: 700,
};

const checkLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  color: "#e9e9ef",
  fontSize: 13,
};
