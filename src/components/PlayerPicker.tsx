import React from "react";
import type { Profile } from "../lib/types";
import ProfileAvatar from "./ProfileAvatar";

export default function PlayerPicker({
  profiles, value, onChange, titleLeft="Joueurs disponibles", titleRight="Joueurs sélectionnés",
}:{
  profiles: Profile[];
  value: string[];                      // selected ids
  onChange: (ids:string[]) => void;
  titleLeft?: string; titleRight?: string;
}) {
  const add = (id:string)=> onChange([...value, id]);
  const remove = (id:string)=> onChange(value.filter(v=>v!==id));

  const left = profiles.filter(p=>!value.includes(p.id));
  const right = value.map(id => profiles.find(p=>p.id===id)!).filter(Boolean);

  return (
    <div className="grid2" style={{marginTop:12}}>
      <div className="card">
        <b style={{color:"var(--gold)"}}>{titleLeft}</b>
        <div className="list" style={{marginTop:8}}>
          {left.map(p=>(
            <button key={p.id} className="item" style={{textAlign:"left"}} onClick={()=>add(p.id)}>
              <div className="row">
                <ProfileAvatar size={44} dataUrl={p.avatarDataUrl} label={p.name[0]?.toUpperCase()}/>
                <div><b>{p.name}</b></div>
              </div>
              <div className="btn">Ajouter</div>
            </button>
          ))}
          {left.length===0 && <div className="item">—</div>}
        </div>
      </div>
      <div className="card">
        <b style={{color:"var(--gold)"}}>{titleRight}</b>
        <div className="list" style={{marginTop:8}}>
          {right.map(p=>(
            <div key={p.id} className="item">
              <div className="row">
                <ProfileAvatar size={44} dataUrl={p.avatarDataUrl} label={p.name[0]?.toUpperCase()}/>
                <div><b>{p.name}</b></div>
              </div>
              <button className="btn danger" onClick={()=>remove(p.id)}>Retirer</button>
            </div>
          ))}
          {right.length===0 && <div className="item">—</div>}
        </div>
      </div>
    </div>
  );
}
