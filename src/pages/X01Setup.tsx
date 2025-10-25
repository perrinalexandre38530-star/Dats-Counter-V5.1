import React from "react";
import Section from "../components/Section";
import PlayerPicker from "../components/PlayerPicker";
import type { Profile } from "../lib/types";
import RulesModal from "../components/RulesModal";

export default function X01Setup({
  profiles,onStart,defaults
}:{
  profiles:Profile[];
  onStart:(ids:string[], start:301|501|701|1001, doubleOut:boolean)=>void;
  defaults:{start:301|501|701|1001; doubleOut:boolean}
}){
  const [sel,setSel]=React.useState<string[]>([]);
  const [start,setStart]=React.useState(defaults.start);
  const [doubleOut,setDoubleOut]=React.useState(defaults.doubleOut);
  const [openRules,setOpenRules]=React.useState(false);

  return (
    <div className="container">
      <Section title="Paramètres X01" right={<button className="btn" onClick={()=>setOpenRules(true)}>i</button>}>
        <div className="grid2">
          <div>
            <div className="small">Score de départ</div>
            <div className="row" style={{gap:8, marginTop:6}}>
              {[301,501,701,1001].map(n=>
                <button key={n} className={`btn ${start===n?"primary":""}`} onClick={()=>setStart(n as any)}>{n}</button>
              )}
            </div>
          </div>
          <div>
            <div className="small">Out mode</div>
            <select className="input" style={{marginTop:6}}
              value={doubleOut? "double":"straight"}
              onChange={e=>setDoubleOut(e.target.value==="double")}>
              <option value="straight">Straight</option>
              <option value="double">Double</option>
            </select>
          </div>
        </div>

        <PlayerPicker profiles={profiles} value={sel} onChange={setSel}
          titleLeft="Joueurs disponibles" titleRight="Joueurs sélectionnés" />

        <div className="row-between" style={{marginTop:12}}>
          <button className="btn" onClick={()=>history.back()}>Annuler</button>
          <button className="btn ok" onClick={()=>sel.length? onStart(sel,start,doubleOut):alert("Sélectionne au moins 1 joueur.")}>
            Lancer la partie
          </button>
        </div>
      </Section>

      <RulesModal open={openRules} onClose={()=>setOpenRules(false)} title="Règles — X01">
        Départ au score choisi. Bust si score &lt; 0 ou = 1.  
        Sortie en double si l’option est activée (D ou Bull 50).  
        Premier joueur à atteindre 0 gagne la manche.
      </RulesModal>
    </div>
  );
}
