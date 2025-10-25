import React from "react";
import Section from "../components/Section";
import PlayerPicker from "../components/PlayerPicker";
import type { Profile } from "../lib/types";

export default function LobbyPick({
  profiles, onStart, title
}:{
  profiles: Profile[];
  onStart: (ids:string[]) => void;
  title: string;
}){
  const [sel,setSel]=React.useState<string[]>([]);
  return (
    <div className="container">
      <Section title={title}>
        <PlayerPicker profiles={profiles} value={sel} onChange={setSel}/>
        <div className="row-between" style={{marginTop:12}}>
          <button className="btn" onClick={()=>history.back()}>Annuler</button>
          <button className="btn ok" onClick={()=>sel.length? onStart(sel):alert("Sélectionne au moins 1 joueur.")}>Lancer la partie</button>
        </div>
      </Section>
    </div>
  );
}
