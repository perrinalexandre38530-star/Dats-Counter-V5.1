import React from "react";
import Section from "../components/Section";
import type { Store } from "../lib/types";
import { computeStats } from "../lib/stats";
import React from "react";
import StatsHub from "./StatsHub";
export default function StatsPage() { return <StatsHub />; }

export default function StatsPage({store}:{store:Store}){
  const [pid,setPid]=React.useState(store.profiles[0]?.id || "");
  const stats = pid? computeStats(store,pid) : null;

  return (
    <div className="container">
      <Section title="Statistiques">
        <div className="row" style={{gap:8}}>
          <select className="input" value={pid} onChange={e=>setPid(e.target.value)}>
            {store.profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn">Données démo</button>
          <button className="btn">Export</button>
        </div>
        {stats && (
          <div className="grid2" style={{marginTop:12}}>
            <div className="card"><div className="small">Moyenne / 3 flèches</div><div style={{fontSize:28}}>{stats.avg3} pts</div></div>
            <div className="card"><div className="small">Meilleure volée</div><div style={{fontSize:28}}>{stats.bestVisit}</div></div>
            <div className="card"><div className="small">Taux de victoire</div><div style={{fontSize:28}}>{Math.round(stats.winRate*100)} %</div></div>
            <div className="card"><div className="small">Plus haut checkout</div><div style={{fontSize:28}}>{stats.bestCheckout}</div></div>
          </div>
        )}
      </Section>
      <Section title="Graphes (placeholder)">
        <div className="card">Évolution & répartition — à brancher sur une lib de charts plus tard.</div>
      </Section>
    </div>
  );
}
