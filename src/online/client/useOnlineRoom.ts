import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientEvent, ServerEvent, RoomState, RoomId, PlayerId, VisitInput } from "../shared/types";

const WS_URL = import.meta.env.VITE_ONLINE_WS_URL as string; 
// ex: ws://127.0.0.1:8787/ws ou wss://darts-online.tondomaine.workers.dev/ws

export function useOnlineRoom(roomId: RoomId, self: {id: PlayerId; name: string}) {
  const [state, setState] = useState<RoomState | null>(null);
  const [version, setVersion] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

  const send = (ev: ClientEvent) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(ev));
  };

  const connect = () => {
    const url = `${WS_URL}?roomId=${encodeURIComponent(roomId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      send({ t: "join_room", roomId, playerId: self.id, name: self.name });
    };
    ws.onmessage = (e) => {
      const data: ServerEvent = JSON.parse(e.data);
      if (data.t === "server_update") {
        setVersion(data.v);
        setState(data.state);
      }
    };
    ws.onclose = () => {
      wsRef.current = null;
      // backoff simple
      reconnectRef.current = window.setTimeout(connect, 800);
    };
    ws.onerror = () => {
      try { ws.close(); } catch {}
    };
  };

  useEffect(()=>{ connect(); return ()=>{ if (wsRef.current) wsRef.current.close(); if (reconnectRef.current) clearTimeout(reconnectRef.current); }; }, [roomId, self.id]);

  // Helpers
  const startX01 = (startScore: number, order: PlayerId[]) =>
    send({ t: "start_match", start: { game: "x01", startScore, order } });

  const throwVisit = (darts: VisitInput) => send({ t: "throw_visit", darts });

  const undoLast = () => send({ t: "undo_last" });

  const leaveRoom = () => send({ t: "leave_room" });

  return { state, version, startX01, throwVisit, undoLast, leaveRoom };
}
