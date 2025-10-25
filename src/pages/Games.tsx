import React from "react";
import Section from "../components/Section";
import RulesModal from "../components/RulesModal";

export default function Games({onChoose}:{onChoose:(mode:"X01"|"Cricket"|"Killer"|"Shanghai")=>void}){
  const items = [
    {k:"X01", sub:"301/501/701/1001 — double-out", rules:
      "Départ au score choisi. Bust si score < 0 ou = 1. Sortie en double si activée. Premier à 0 gagne."},
    {k:"Cricket", sub:"15–20 + Bull, fermetures & points", rules:
      "Marques: S=1, D=2, T=3. Ferme un numéro à 3 marques. Après fermeture, tu marques si les autres n’ont pas fermé."},
    {k:"Killer", sub:"Double de ton numéro → deviens Killer", rules:
      "Chaque joueur reçoit un numéro 1..20. Devient Killer en touchant le double de ton numéro. Un double sur le numéro d’un adversaire lui retire une vie."},
    {k:"Shanghai", sub:"Cible du tour, S/D/T — Shanghai = win", rules:
      "Cible N par manche. Points = N×multiplicateur. S+D+T du même N dans la volée = victoire immédiate."},
  ] as const;

  const [open,setOpen]=React.useState<{title:string,text:string}|null>(null);

  return (
    <div className="container">
      <h1 className="title-xl" style={{marginBottom:12}}>Tous les jeux</h1>
      <div className="subtitle" style={{marginBottom:14}}>Choisis un mode — clique sur i pour voir les règles</div>

      {items.map(({k,sub,rules})=>(
        <div className="card" key={k} style={{marginBottom:12}}>
          <div className="row-between">
            <div>
              <div style={{fontWeight:800,fontSize:18}}>{k}</div>
              <div className="subtitle">{sub}</div>
            </div>
            <div className="row" style={{gap:8}}>
              <button className="btn ghost" title="Règles" onClick={()=>setOpen({title:`Règles — ${k}`, text:rules})}>i</button>
              <button className="btn primary" onClick={()=>onChoose(k as any)}>Choisir</button>
            </div>
          </div>
        </div>
      ))}

      <RulesModal open={!!open} onClose={()=>setOpen(null)} title={open?.title||""}>
        {open?.text}
      </RulesModal>
    </div>
  );
}
