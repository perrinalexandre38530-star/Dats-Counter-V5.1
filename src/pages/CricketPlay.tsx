import React from "react";
import Section from "../components/Section";
import Keypad from "../components/Keypad";
import type { Dart, MatchRecord, Store } from "../lib/types";
import { createCricket, applyCricketThrow } from "../lib/rules_cricket";
import { profileMap } from "../lib/selectors";
import ProfileAvatar from "../components/ProfileAvatar";

export default function CricketPlay({
  playerIds, onFinish, store
}:{ playerIds:string[]; onFinish:(m:MatchRecord)=>void; store: Store }){
  const [match,setMatch]=React.useState<MatchRecord>(()=>createCricket(playerIds));
  const [turn,setTurn]=React.useState(0);
  const { nameOf, avatarOf } = profileMap(store);

  function onSubmit(darts:Dart[]){
    const r = match.rounds[match.rounds.length-1];
    const slot = r && r.length<match.header.players.length ? r : (match.rounds.push([]), match.rounds[match.rounds.length-1]);
    slot[turn]=darts;

    const res = applyCricketThrow(match, turn, darts);
    if (res.finished){ setMatch({...match}); onFinish(match); return; }

    const next = (turn+1) % match.header.players.length;
    setTurn(next);
    setMatch({...match});
  }

  const points = match.header.meta.points as Record<string,number>;
  return (
    <div className="container">
      <Section title="Cricket">
        <div className="small">Joueur: {nameOf(match.header.players[turn])}</div>
      </Section>
      <Section title="Scores">
        <div className="list">
          {match.header.players.map((pid)=>(
            <div key={pid} className="item">
              <div className="row" style={{gap:10}}>
                <ProfileAvatar size={40} dataUrl={avatarOf(pid)} label={nameOf(pid)[0]?.toUpperCase()}/>
                <b>{nameOf(pid)}</b>
              </div>
              <div style={{fontSize:24}}>{points[pid]}</div>
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
