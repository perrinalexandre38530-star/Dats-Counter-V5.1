import React from "react";
export default function Section({title, children, right}:{title:string;children:React.ReactNode; right?:React.ReactNode}){
  return (
    <div className="card" style={{marginBottom:14}}>
      <div className="row-between" style={{marginBottom:8}}>
        <div className="row" style={{gap:8,alignItems:"baseline"}}>
          <span className="title-accent">{title}</span>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
