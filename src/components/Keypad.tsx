import React from "react";
import type { Dart } from "../lib/types";

export default function Keypad({onSubmit,label="Valider"}:{onSubmit:(d:Dart[])=>void;label?:string}){
  const [darts,setDarts]=React.useState<Array<Dart|null>>([null,null,null]);
  const [idx,setIdx]=React.useState(0);
  const [mult,setMult]=React.useState<1|2|3>(1);

  function push(v:number, lbl?:string){
    const next=[...darts];
    next[idx]={v, mult, label:lbl};
    const nextIdx=Math.min(2, idx+1);
    setDarts(next); setIdx(nextIdx);
  }
  function bull(){ push(25, "BULL"); }
  function del(){
    const next=[...darts];
    let i = idx;
    if (next[i]==null && i>0) i--;
    next[i]=null; setDarts(next); setIdx(i);
  }
  function submit(){
    onSubmit(darts.filter(Boolean) as Dart[]);
    setDarts([null,null,null]); setIdx(0); setMult(1);
  }

  const styleToggle = (m:1|2|3)=>({ background: mult===m? (m===2?"#0f3344":"#3a1038"):"#15151c", borderColor:"rgba(255,255,255,.08)" });

  return (
    <div className="kbd">
      <div className="kbd-top">
        <button className="btn" style={{...styleToggle(2),flex:1}} onClick={()=>setMult(2)}>DOUBLE</button>
        <button className="btn" style={{...styleToggle(3),flex:1}} onClick={()=>setMult(3)}>TRIPLE</button>
        <button className="btn" style={{flex:1}} onClick={del}>←</button>
      </div>
      <div className="kbd-keys" style={{marginBottom:10}}>
        {Array.from({length:21},(_,i)=>i).map(n=>
          <div key={n} className="k" onClick={()=>push(n)}>{n}</div>
        )}
        <div className="k big bull" onClick={bull}>BULL</div>
      </div>
      <div className="row" style={{justifyContent:"flex-end"}}>
        <button className="btn primary" onClick={submit}>{label}</button>
      </div>
    </div>
  );
}
