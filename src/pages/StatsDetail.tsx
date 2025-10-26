import React from "react";
import { History } from "../lib/history";

export default function StatsDetail({ params, go }) {
  const rec = History.get(params?.matchId);
  if (!rec) return <div style={{ padding: 16 }}>Aucune donnée</div>;

  const date = new Date(rec.updatedAt).toLocaleString();
  const players = rec.players.map(p => p.name).join(" · ");
  const winner = rec.players.find(p => p.id === rec.winnerId)?.name ?? "—";

  return (
    <div style={{ padding: 16 }}>
      <button onClick={() => go("history")} style={{ marginBottom: 12 }}>← Retour</button>
      <h2>{rec.kind.toUpperCase()} — {date}</h2>
      <div>Joueurs : {players}</div>
      <div>Vainqueur : 🏆 {winner}</div>
    </div>
  );
}
