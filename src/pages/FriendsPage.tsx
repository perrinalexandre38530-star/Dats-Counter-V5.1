import React from "react";
import Section from "../components/Section";
export default function FriendsPage(){
  return (
    <div className="container">
      <Section title="Amis en ligne">
        <div className="badge"><div style={{width:10,height:10,background:"#18d36a",borderRadius:999}}/>Connecte-toi pour voir tes amis.</div>
      </Section>
    </div>
  );
}
