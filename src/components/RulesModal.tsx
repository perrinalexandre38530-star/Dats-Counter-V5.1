import React from "react";

export default function RulesModal({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode}){
  if(!open) return null;
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.6)", display:"grid", placeItems:"center", zIndex:60
    }} onClick={onClose}>
      <div className="card" style={{maxWidth:720, width:"92%", maxHeight:"80vh", overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="row-between" style={{marginBottom:8}}>
          <h2>{title}</h2>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
        <div className="subtitle" style={{lineHeight:1.6}}>{children}</div>
      </div>
    </div>
  );
}
