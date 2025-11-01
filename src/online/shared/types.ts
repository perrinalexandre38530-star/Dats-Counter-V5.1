export type PlayerId = string;
export type RoomId = string;

export type VisitInput = number[]; // ex: [60, 0, 5] ou [85] si tu entres un agrégat

export type ClientEvent =
  | { t: "join_room"; roomId: RoomId; playerId: PlayerId; name: string }
  | { t: "start_match"; start: { game: "x01"; startScore: number; order: PlayerId[] } }
  | { t: "throw_visit"; darts: VisitInput } // pour le joueur actif
  | { t: "undo_last" }
  | { t: "leave_room" }
  | { t: "ping" };

export type ServerEvent =
  | { t: "server_update"; v: number; state: RoomState }
  | { t: "error"; code: string; msg: string }
  | { t: "pong" };

export type RoomState = {
  roomId: RoomId;
  clients: { id: PlayerId; name: string }[];   // connectés connus du serveur
  match?: X01Match | null;
};

export type X01Match = {
  game: "x01";
  startScore: number; // e.g. 501
  players: { id: PlayerId; name: string }[];
  turn: PlayerId; // joueur actif
  remaining: Record<PlayerId, number>;
  visits: Record<PlayerId, number[][]>; // volées successives
  legNo: number;
  finished?: { winnerId: PlayerId; order: PlayerId[] } | null;
};
