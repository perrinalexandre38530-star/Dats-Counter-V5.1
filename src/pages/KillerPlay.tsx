import React from "react";
import Section from "../components/Section";
import Keypad from "../components/Keypad";
import type { Dart, MatchRecord, Store } from "../lib/types";
import { createKiller, applyKillerThrow } from "../lib/rules_killer";
import { profileMap } from "../lib/selectors";
import ProfileAvatar from "../components/ProfileAvatar";

export default function KillerPlay({
  playerIds, onFinish, store
}:{ playerIds:string[]; onFinish:(m:MatchRecord)=>void; store: Store }){
  const [match,setMatch]=React.useState<MatchRecord>(()=>createKiller(playerIds));
  const [turn,setTurn]=React.useState(0);
  const { nameOf, avatarOf } = profileMap(store);

  function onSubmit(darts:Dart[]){
    const r = match.rounds[match.rounds.length-1];
    const slot = r && r.length<match.header.players.length ? r : (match.rounds.push([]), match.rounds[match.rounds.length-1]);
    slot[turn]=darts;

    const res = applyKillerThrow(match, turn, darts);
    if (res.finished){ setMatch({...match}); onFinish(match); return; }

    const next = (turn+1) % match.header.players.length;
    setTurn(next);
    setMatch({...match});
  }

  const M = match.header.meta as any;
  return (
    <div className="container">
      <Section title="Killer">
        <div className="list">
          {match.header.players.map(pid=>
            <div key={pid} className="item">
              <div className="row" style={{gap:10}}>
                <ProfileAvatar size={40} dataUrl={avatarOf(pid)} label={nameOf(pid)[0]?.toUpperCase()}/>
                <div><b>{nameOf(pid)}</b> — n° {M.number[pid]} {M.killer[pid]? " (Killer)": ""}</div>
              </div>
              <div>❤️ {M.lives[pid]}</div>
            </div>)}
        </div>
      </Section>
      <Section title="Clavier">
        <Keypad onSubmit={onSubmit}/>
      </Section>
    </div>
  );
}
