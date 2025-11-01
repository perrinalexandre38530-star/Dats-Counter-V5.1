import React, { useMemo, useState } from "react";
import { useOnlineRoom } from "../online/client/useOnlineRoom";
import type { PlayerId } from "../online/shared/types";

function rid() { return Math.random().toString(36).slice(2,10); }

export default function OnlineX01() {
  const [roomId, setRoomId] = useState<string>(()=> new URLSearchParams(location.search).get("room") || "room-dev");
  const [self] = useState(()=>({ id: localStorage.getItem("meId") || (localStorage.setItem("meId", rid()), localStorage.getItem("meId")!) , name: localStorage.getItem("meName") || "Player" }));
  const [nameInput, setNameInput] = useState(localStorage.getItem("meName") || "Player");

  const { state, version, startX01, throwVisit, undoLast } = useOnlineRoom(roomId, {id: self.id, name: nameInput});

  const meIsTurn = useMemo(()=>{
    if (!state?.match) return false;
    return state.match.turn === self.id;
  }, [state, version, self.id]);

  const orderedPlayers = state?.match?.players ?? state?.clients ?? [];

  function handleStart() {
    const order: PlayerId[] = orderedPlayers.map(p=>p.id);
    if (!order.length) return;
    startX01(501, order);
  }

  function handleThrow(sumStr: string) {
    const n = Number(sumStr.trim() || "0");
    if (!isFinite(n)) return;
    // soit en agrégat [n], soit détail [x,y,z]; ici version simple:
    throwVisit([n]);
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-2xl font-bold">Online X01 (démo)</h1>

      <div className="flex items-center gap-2">
        <label className="text-sm">Room:</label>
        <input value={roomId} onChange={e=>setRoomId(e.target.value)} className="px-2 py-1 rounded bg-black/40 border border-white/10"/>
        <label className="text-sm">Mon nom:</label>
        <input value={nameInput} onChange={e=>{ setNameInput(e.target.value); localStorage.setItem("meName", e.target.value);} } className="px-2 py-1 rounded bg-black/40 border border-white/10"/>
      </div>

      <div className="text-xs opacity-70">v{version}</div>

      <div className="rounded-xl p-3 bg-white/5 border border-white/10">
        <div className="font-semibold mb-2">Joueurs</div>
        <div className="flex gap-3 flex-wrap">
          {orderedPlayers.map(p=>(
            <div key={p.id} className={`px-3 py-2 rounded-lg ${state?.match?.turn===p.id?'bg-yellow-500/20':'bg-white/5'}`}>
              <div className="text-sm">{p.name}</div>
              {state?.match && (
                <div className="text-xs opacity-80">Reste: {state.match.remaining[p.id]}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {!state?.match && (
        <button onClick={handleStart} className="px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/50">
          Démarrer un 501
        </button>
      )}

      {state?.match && (
        <div className="space-y-2">
          <div className="text-sm">
            Tour: <span className="font-semibold">{state.match.players.find(p=>p.id===state.match!.turn)?.name}</span>
            {meIsTurn ? " (toi)" : ""}
          </div>
          <div className="flex items-center gap-2">
            <input id="sum" placeholder="Score de ta volée (ex: 60)" className="px-2 py-1 rounded bg-black/40 border border-white/10"/>
            <button onClick={()=>handleThrow((document.getElementById("sum") as HTMLInputElement).value)} disabled={!meIsTurn} className="px-3 py-2 rounded bg-green-500/20 border border-green-500/50 disabled:opacity-40">Valider</button>
            <button onClick={()=>undoLast()} className="px-3 py-2 rounded bg-white/10 border border-white/20">Undo</button>
          </div>
          {state.match.finished && (
            <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40">
              <div className="font-semibold">Manche terminée</div>
              <div>Vainqueur : {state.match.players.find(p=>p.id===state.match!.finished!.winnerId)?.name}</div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs opacity-60">
        Démo : agrégat de volée uniquement (ex: “85”). Double-out et stats fines à brancher ensuite.
      </p>
    </div>
  );
}
