import React from "react";
import Section from "../components/Section";
import PlayerPicker from "../components/PlayerPicker";
import type { Profile } from "../lib/types";
import RulesModal from "../components/RulesModal";

type StartScore = 301 | 501 | 701 | 1001;

export default function X01Setup({
  profiles,
  onStart,
  defaults,
}: {
  profiles: Profile[];
  /**
   * Appel au démarrage :
   * - compat : (ids, start, doubleOut)
   * - étendu : (ids, start, doubleOut, { setsToWin, legsToWin })
   */
  onStart: (
    ids: string[],
    start: StartScore,
    doubleOut: boolean,
    setLeg?: { setsToWin: number; legsToWin: number }
  ) => void;
  /** Ajout de valeurs par défaut pour Sets/Legs (1 = désactivé) */
  defaults: {
    start: StartScore;
    doubleOut: boolean;
    setsToWin?: number;
    legsToWin?: number;
  };
}) {
  const [sel, setSel] = React.useState<string[]>([]);
  const [start, setStart] = React.useState<StartScore>(defaults.start);
  const [doubleOut, setDoubleOut] = React.useState<boolean>(defaults.doubleOut);
  // --- NEW: format du match (1 = pas de sets/legs)
  const [setsToWin, setSetsToWin] = React.useState<number>(defaults.setsToWin ?? 1);
  const [legsToWin, setLegsToWin] = React.useState<number>(defaults.legsToWin ?? 1);

  const [openRules, setOpenRules] = React.useState(false);

  function launch() {
    if (!sel.length) {
      alert("Sélectionne au moins 1 joueur.");
      return;
    }
    onStart(sel, start, doubleOut, {
      setsToWin: Math.max(1, Math.floor(setsToWin || 1)),
      legsToWin: Math.max(1, Math.floor(legsToWin || 1)),
    });
  }

  return (
    <div className="container">
      <Section
        title="Paramètres X01"
        right={
          <button className="btn" onClick={() => setOpenRules(true)}>
            i
          </button>
        }
      >
        <div className="grid2">
          <div>
            <div className="small">Score de départ</div>
            <div className="row" style={{ gap: 8, marginTop: 6 }}>
              {[301, 501, 701, 1001].map((n) => (
                <button
                  key={n}
                  className={`btn ${start === (n as StartScore) ? "primary" : ""}`}
                  onClick={() => setStart(n as StartScore)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="small">Mode de sortie</div>
            <select
              className="input"
              style={{ marginTop: 6 }}
              value={doubleOut ? "double" : "straight"}
              onChange={(e) => setDoubleOut(e.target.value === "double")}
            >
              <option value="straight">Straight</option>
              <option value="double">Double</option>
            </select>
          </div>
        </div>

        {/* --- NEW: Format du match (Sets / Legs) --- */}
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Format du match</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>Sets à gagner</span>
              <input
                type="number"
                min={1}
                value={setsToWin}
                onChange={(e) => setSetsToWin(Number(e.target.value))}
                className="input"
                style={{
                  padding: 10,
                  borderRadius: 10,
                }}
              />
              <small style={{ opacity: 0.7 }}>1 = pas de sets (match en un seul set)</small>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span>Legs à gagner (par set)</span>
              <input
                type="number"
                min={1}
                value={legsToWin}
                onChange={(e) => setLegsToWin(Number(e.target.value))}
                className="input"
                style={{
                  padding: 10,
                  borderRadius: 10,
                }}
              />
              <small style={{ opacity: 0.7 }}>
                1 = pas de format “best-of” dans un set
              </small>
            </label>
          </div>
        </div>

        <PlayerPicker
          profiles={profiles}
          value={sel}
          onChange={setSel}
          titleLeft="Joueurs disponibles"
          titleRight="Joueurs sélectionnés"
        />

        <div className="row-between" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => history.back()}>
            Annuler
          </button>
          <button className="btn ok" onClick={launch}>
            Lancer la partie
          </button>
        </div>
      </Section>

      <RulesModal open={openRules} onClose={() => setOpenRules(false)} title="Règles — X01">
        Départ au score choisi. Bust si score &lt; 0 ou = 1.
        <br />
        Sortie en double si l’option est activée (D ou Bull 50).
        <br />
        Le premier joueur à atteindre 0 gagne la manche.
        <br />
        <br />
        <strong>Format du match :</strong> vous pouvez activer les <em>sets</em> (plusieurs
        manches à gagner) et/ou les <em>legs</em> à gagner par set. Une valeur de <code>1</code>{" "}
        signifie que la dimension correspondante est désactivée.
      </RulesModal>
    </div>
  );
}
