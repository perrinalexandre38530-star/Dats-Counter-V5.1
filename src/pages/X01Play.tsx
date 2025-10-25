import React from "react";
import Section from "../components/Section";
import Keypad from "../components/Keypad";
import type { Dart, MatchRecord, Store } from "../lib/types";
import { createX01, applyX01Throw } from "../lib/rules_x01";
import { profileMap } from "../lib/selectors";
import ProfileAvatar from "../components/ProfileAvatar";

// On passe le store pour afficher noms/avatars
export default function X01Play({
  playerIds, start, doubleOut, onFinish, store
}:{
  playerIds: string[];
  start: 301|501|701|1001;
  doubleOut: boolean;
  onFinish: (m: MatchRecord) => void;
  store: Store;
}){
  const [match,setMatch]=React.useState<MatchRecord>(()=>createX01(playerIds,{start,doubleOut}));
  const [turn,setTurn]=React.useState(0);
  const { nameOf, avatarOf } = profileMap(store);

  function onSubmit(darts:Dart[]){
    const r = match.rounds[match.rounds.length-1];
    const slot = r && r.length<match.header.players.length ? r : (match.rounds.push([]), match.rounds[match.rounds.length-1]);
    slot[turn]=darts;

    const res = applyX01Throw(match, turn, darts);
    if (res.finished){ setMatch({...match}); onFinish(match); return; }
    const next = (turn+1) % match.header.players.length;
    setTurn(next); setMatch({...match});
  }

  const scores = match.header.meta.scores as Record<string,number>;
  const pid = match.header.players[turn];

  return (
    <div className="container">
      <div className="card" style={{marginBottom:12, padding:"18px"}}>
        <div className="row-between">
          <button className="btn" onClick={()=>history.back()}>← Quitter</button>
          <div className="small">Mode : <b>X01</b> · Départ {start}{doubleOut?" · DO":" · SO"}</div>
        </div>
        <div className="row" style={{gap:10, alignItems:"center", marginTop:8}}>
          <ProfileAvatar size={44} dataUrl={avatarOf(pid)} label={nameOf(pid)[0]?.toUpperCase()}/>
          <div style={{fontWeight:700}}>{nameOf(pid)}</div>
        </div>
        <div style={{fontSize:64, fontWeight:800, color:"var(--gold)", textShadow:"0 8px 30px rgba(240,177,42,.35)", marginTop:6}}>
          {scores[pid]}
        </div>
        <div className="subtitle">Joueur {turn+1}/{match.header.players.length}</div>
      </div>

      <Section title="Joueurs">
        <div className="list">
          {match.header.players.map((p,i)=>(
            <div key={p} className="item" style={{opacity: i===turn?1:.85}}>
              <div className="row" style={{gap:10}}>
                <ProfileAvatar size={40} dataUrl={avatarOf(p)} label={nameOf(p)[0]?.toUpperCase()}/>
                <div><b>{nameOf(p)}</b><div className="small">—</div></div>
              </div>
              <div style={{fontSize:24, color:"var(--gold)"}}>{scores[p]}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Clavier">
        <Keypad onSubmit={onSubmit}/>
      </Section>
    </div>
  );
}
