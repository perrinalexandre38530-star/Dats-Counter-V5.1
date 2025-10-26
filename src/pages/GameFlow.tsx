// ============================================
// src/pages/GameFlow.tsx — Menu → Setup → Play (moteur branché)
// ============================================
import React from "react";
import type { Store, Profile } from "../lib/types";
import {
  profilesToPlayers,
  toMode,
} from "../lib/types-game";
import type {
  MatchRules,
  Mode,
  GameDart,
} from "../lib/types-game";
import { getEngine } from "../lib/gameEngines";

/* ---------- UI Helpers très simples ---------- */
const Card: React.FC<React.PropsWithChildren<{title?: string; subtitle?: string; right?: React.ReactNode}>> = ({ title, subtitle, right, children }) => (
  <div style={{
    background: "linear-gradient(180deg, rgba(25,25,28,.6), rgba(15,15,18,.7))",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12
  }}>
    {(title || right) && (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: 6 }}>
        <div>
          {title && <div style={{ fontWeight:600 }}>{title}</div>}
          {subtitle && <div style={{ fontSize:12, opacity:.75 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
    )}
    {children}
  </div>
);

const Btn = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} style={{
    padding:"8px 12px",
    borderRadius: 999,
    border:"1px solid rgba(255,255,255,.12)",
    background:"linear-gradient(180deg, rgba(255,196,54,.95), rgba(255,165,0,.95))",
    color:"#1a1a1a",
    fontWeight:700,
    cursor:"pointer"
  }} />
);

/* ---------- Étapes du flow ---------- */
type Step =
  | { k: "menu" }
  | { k: "setup"; mode: Mode }
  | { k: "play"; rules: MatchRules; players: Profile[] };

export default function GameFlow({ store }: { store: Store }) {
  const profiles = store?.profiles ?? [];

  const [step, setStep] = React.useState<Step>({ k: "menu" });

  // ========== ÉTAPE 1 — MENU ==========
  if (step.k === "menu") {
    return (
      <div style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>Tous les jeux</h2>

        <Card title="X01" subtitle="301/501/701/1001 — double-out"
          right={<Btn onClick={() => setStep({ k: "setup", mode: "x01" })}>Choisir</Btn>}
        />
        <Card title="Cricket" subtitle="15→20 + Bull, fermetures & points"
          right={<Btn onClick={() => setStep({ k: "setup", mode: "cricket" })}>Choisir</Btn>}
        />
        <Card title="Killer" subtitle="Double de ton numéro → deviens Killer"
          right={<Btn onClick={() => setStep({ k: "setup", mode: "killer" })}>Choisir</Btn>}
        />
        <Card title="Shanghai" subtitle="Cible du tour, S/D/T — Shanghai = win"
          right={<Btn onClick={() => setStep({ k: "setup", mode: "shanghai" })}>Choisir</Btn>}
        />
      </div>
    );
  }

  // ========== ÉTAPE 2 — SETUP ==========
  if (step.k === "setup") {
    return (
      <SetupScreen
        store={store}
        mode={step.mode}
        onBack={() => setStep({ k: "menu" })}
        onStart={(rules, chosen) => setStep({ k: "play", rules, players: chosen })}
      />
    );
  }

  // ========== ÉTAPE 3 — PLAY (moteur branché) ==========
  if (step.k === "play") {
    return (
      <PlayHost
        rules={step.rules}
        players={step.players}
        onExit={() => setStep({ k: "menu" })}
      />
    );
  }

  return null;
}

/* =========================================================
   Écran de réglages génériques (un par mode) + sélection joueurs
   → minimal pour démarrer; remplace ensuite par tes pages dédiées
   ========================================================= */
function SetupScreen({
  store, mode, onBack, onStart
}: {
  store: Store;
  mode: Mode;
  onBack: () => void;
  onStart: (rules: MatchRules, chosen: Profile[]) => void;
}) {
  const profiles = store?.profiles ?? [];

  // Règles par défaut (tu peux relier à store.settings)
  const [x01, setX01] = React.useState<{ start: 301|501|701|1001; doubleOut: boolean; doubleIn: boolean }>({
    start: (store?.settings?.defaultX01 ?? 501) as 301|501|701|1001,
    doubleOut: !!store?.settings?.doubleOut,
    doubleIn: false,
  });
  const [useBull, setUseBull] = React.useState(true);
  const [cutThroat, setCutThroat] = React.useState(false);
  const [lives, setLives] = React.useState(3);
  const [rounds, setRounds] = React.useState<number[]>(Array.from({length:20},(_,i)=>i+1));

  const [available, setAvailable] = React.useState<Profile[]>(profiles);
  const [chosen, setChosen] = React.useState<Profile[]>([]);

  function add(p: Profile) {
    setAvailable(a => a.filter(x => x.id !== p.id));
    setChosen(c => [...c, p]);
  }
  function remove(p: Profile) {
    setChosen(c => c.filter(x => x.id !== p.id));
    setAvailable(a => [...a, p]);
  }

  let rules: MatchRules;
  switch (mode) {
    case "x01":
      rules = { mode, startingScore: x01.start, doubleOut: x01.doubleOut, doubleIn: x01.doubleIn };
      break;
    case "cricket":
      rules = { mode, useBull, cutThroat };
      break;
    case "killer":
      rules = { mode, livesPerPlayer: lives, tripleCountsAs: 3, doubleCountsAs: 2, singleCountsAs: 1 };
      break;
    case "shanghai":
      rules = { mode, rounds, instantWinOnShanghai: true };
      break;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: 12 }}>
        <button onClick={onBack} style={{ padding:"6px 10px", borderRadius:10 }}>← Retour</button>
        <h2 style={{ margin:0, textTransform:"capitalize" }}>Paramètres {mode}</h2>
      </div>

      {mode === "x01" && (
        <Card title="Score de départ">
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {[301,501,701,1001].map(n => (
              <button key={n} onClick={() => setX01(s => ({...s, start: n as 301|501|701|1001}))}
                style={{
                  padding:"6px 10px", borderRadius:10,
                  border: x01.start===n ? "2px solid #ffc107" : "1px solid rgba(255,255,255,.12)",
                  background:"rgba(255,255,255,.06)", color:"#fff"
                }}>{n}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:16, marginTop:10, fontSize:14 }}>
            <label style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input type="checkbox" checked={x01.doubleOut} onChange={e => setX01(s=>({...s,doubleOut:e.target.checked}))} />
              Double-out
            </label>
            <label style={{ display:"flex", gap:6, alignItems:"center" }}>
              <input type="checkbox" checked={x01.doubleIn} onChange={e => setX01(s=>({...s,doubleIn:e.target.checked}))} />
              Double-in
            </label>
          </div>
        </Card>
      )}

      {mode === "cricket" && (
        <Card title="Options Cricket">
          <label style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8 }}>
            <input type="checkbox" checked={useBull} onChange={e=>setUseBull(e.target.checked)} />
            Inclure Bull (25/50)
          </label>
          <label style={{ display:"flex", gap:6, alignItems:"center" }}>
            <input type="checkbox" checked={cutThroat} onChange={e=>setCutThroat(e.target.checked)} />
            Cut-Throat
          </label>
        </Card>
      )}

      {mode === "killer" && (
        <Card title="Vies par joueur">
          <input type="number" min={1} max={10} value={lives} onChange={e=>setLives(Math.max(1,Math.min(10, parseInt(e.target.value)||3)))} />
        </Card>
      )}

      {mode === "shanghai" && (
        <Card title="Rounds">
          <div style={{ fontSize:13, opacity:.8 }}>
            Par défaut: 1 → 20. Tu pourras plus tard personnaliser.
          </div>
        </Card>
      )}

      <Card title="Joueurs disponibles">
        {available.length === 0 ? <div style={{ opacity:.7 }}>Aucun profil disponible.</div> : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8 }}>
            {available.map(p => (
              <React.Fragment key={p.id}>
                <div>{p.name}</div>
                <button onClick={() => add(p)} style={{ padding:"6px 10px", borderRadius:10 }}>Ajouter</button>
              </React.Fragment>
            ))}
          </div>
        )}
      </Card>

      <Card title="Joueurs sélectionnés">
        {chosen.length === 0 ? <div style={{ opacity:.7 }}>Sélectionne au moins un joueur.</div> : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8 }}>
            {chosen.map(p => (
              <React.Fragment key={p.id}>
                <div>{p.name}</div>
                <button onClick={() => remove(p)} style={{ padding:"6px 10px", borderRadius:10, background:"#ff6b6b", color:"#111" }}>Retirer</button>
              </React.Fragment>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <Btn
          onClick={() => onStart(rules, chosen)}
          disabled={chosen.length === 0}
        >
          Démarrer
        </Btn>
      </div>
    </div>
  );
}

/* =========================================================
   Hôte minimal de partie (moteur générique)
   → branche les moteurs et montre que ça tourne
   ========================================================= */
function PlayHost({
  rules, players, onExit
}: {
  rules: MatchRules;
  players: Profile[];
  onExit: () => void;
}) {
  const engine = React.useMemo(() => getEngine(rules.mode), [rules.mode]);
  const playerModels = React.useMemo(() => profilesToPlayers(players), [players]);
  const [state, setState] = React.useState(() => engine.initGame(playerModels, rules));

  // Démo: 3 boutons pour envoyer des volées rapidement
  function submit(darts: GameDart[]) {
    setState(prev => engine.playTurn(prev, darts));
  }

  const isOver = engine.isGameOver(state);
  const winner = engine.getWinner(state);

  // Quelques helpers d'essai
  const MISS: GameDart = { bed:"MISS" };
  const T20: GameDart = { bed:"T", number: 20 };
  const D20: GameDart = { bed:"D", number: 20 };
  const S20: GameDart = { bed:"S", number: 20 };
  const OB: GameDart = { bed:"OB" };
  const IB: GameDart = { bed:"IB" };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: 12 }}>
        <button onClick={onExit} style={{ padding:"6px 10px", borderRadius:10 }}>← Quitter</button>
        <h2 style={{ margin:0, textTransform:"capitalize" }}>{rules.mode} — Partie</h2>
      </div>

      <Card title="Infos">
        <div style={{ fontSize:14, opacity:.85 }}>
          Joueur courant: <strong>{state.players[state.currentPlayerIndex]?.name}</strong><br/>
          Tour n°: {state.turnIndex + 1}
        </div>
      </Card>

      {rules.mode === "x01" && (
        <Card title="Scores (X01)">
          <ul style={{ margin:0, paddingLeft:18 }}>
            {state.players.map(p => (
              <li key={p.id}>
                {p.name}: {(state as any).table[p.id].score}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rules.mode === "cricket" && (
        <Card title="Scores (Cricket)">
          <ul style={{ margin:0, paddingLeft:18 }}>
            {state.players.map(p => (
              <li key={p.id}>
                {p.name}: {(state as any).scores[p.id]}
              </li>
            ))}
          </ul>
          <div style={{ fontSize:12, opacity:.75, marginTop:6 }}>
            (Les “marks” sont bien tenus dans le moteur)
          </div>
        </Card>
      )}

      {rules.mode === "killer" && (
        <Card title="Vies (Killer)">
          <ul style={{ margin:0, paddingLeft:18 }}>
            {state.players.map(p => (
              <li key={p.id}>
                {p.name}: {(state as any).table[p.id].lives} { (state as any).table[p.id].killer ? " (Killer)" : "" }
              </li>
            ))}
          </ul>
        </Card>
      )}

      {rules.mode === "shanghai" && (
        <Card title="Scores (Shanghai)">
          <div>Round: {(state as any).roundIndex + 1}</div>
          <ul style={{ margin:0, paddingLeft:18 }}>
            {state.players.map(p => (
              <li key={p.id}>
                {p.name}: {(state as any).scores[p.id]}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Volées rapides (démo)" subtitle="Brancher ensuite tes NeonDartBoxes ici">
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Btn onClick={() => submit([MISS, MISS, MISS])}>MISS MISS MISS</Btn>
          {rules.mode === "x01" && (
            <>
              <Btn onClick={() => submit([T20, T20, T20])}>T20 T20 T20</Btn>
              <Btn onClick={() => submit([T20, D20, D20])}>T20 D20 D20</Btn>
              <Btn onClick={() => submit([S20, S20, S20])}>S20 S20 S20</Btn>
            </>
          )}
          {rules.mode === "cricket" && (
            <>
              <Btn onClick={() => submit([T20, T20, T20])}>T20 T20 T20</Btn>
              <Btn onClick={() => submit([OB, IB, T20])}>OB IB T20</Btn>
            </>
          )}
          {rules.mode === "killer" && (
            <>
              <Btn onClick={() => submit([D20, D20, D20])}>Doubles 20</Btn>
              <Btn onClick={() => submit([T20, T20, T20])}>Triples 20</Btn>
            </>
          )}
          {rules.mode === "shanghai" && (
            <>
              <Btn onClick={() => submit([S20, D20, T20])}>S/D/T 20</Btn>
              <Btn onClick={() => submit([OB, IB, S20])}>OB IB S20</Btn>
            </>
          )}
        </div>
      </Card>

      {isOver && (
        <Card title="Résultat">
          <div style={{ fontSize:16 }}>
            Partie terminée — Gagnant : <strong>{winner?.name ?? "—"}</strong>
          </div>
          <div style={{ marginTop:10 }}>
            <Btn onClick={onExit}>Retour au menu</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
