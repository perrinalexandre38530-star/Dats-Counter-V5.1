// ============================================
// src/lib/gameEngines/x01.ts
// Minimal, solid X01 engine (supports double-out)
// API used by useX01Engine: initGame, playTurn, isGameOver, getWinner
// ============================================
export type Player = { id: string; name: string };

export type MatchRules = {
  mode: "x01";
  startingScore: 301 | 501 | 701 | 1001;
  doubleOut: boolean;
  doubleIn: boolean; // not used yet (false in our hook), kept for future
};

export type GameDart =
  | { bed: "MISS" }
  | { bed: "OB" } // 25
  | { bed: "IB" } // 50 (counts as double 25)
  | { bed: "S" | "D" | "T"; number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 };

export type X01Turn = { playerId: string; darts: GameDart[] };

export type X01State = {
  rules: MatchRules;
  players: Player[];
  currentPlayerIndex: number;
  turnIndex: number; // counts the player's “visit” number (0-based)
  table: Record<string, { score: number; in?: boolean }>;
  history: X01Turn[];              // sequential turns
  endedAt?: number;
};

// ---------------- utils ----------------
function dartValue(d: GameDart): { points: number; isDouble: boolean } {
  switch (d.bed) {
    case "MISS":
      return { points: 0, isDouble: false };
    case "OB":
      return { points: 25, isDouble: false };
    case "IB":
      return { points: 50, isDouble: true }; // counts as double bull
    default: {
      const mult = d.bed === "S" ? 1 : d.bed === "D" ? 2 : 3;
      const points = (d.number || 0) * mult;
      return { points, isDouble: mult === 2 };
    }
  }
}

function cloneState(s: X01State): X01State {
  return {
    ...s,
    table: JSON.parse(JSON.stringify(s.table)),
    history: s.history.slice(),
  };
}

// ---------------- engine ----------------
export const x01Engine = {
  initGame(players: Player[], rules: MatchRules): X01State {
    const table: X01State["table"] = {};
    players.forEach((p) => (table[p.id] = { score: rules.startingScore, in: !rules.doubleIn }));
    return {
      rules,
      players,
      table,
      currentPlayerIndex: 0,
      turnIndex: 0,
      history: [],
    };
  },

  playTurn(prev: X01State, darts: GameDart[]): X01State {
    const s = cloneState(prev);
    if (this.isGameOver(s)) return s;

    const p = s.players[s.currentPlayerIndex];
    const row = s.table[p.id];

    // double-in rule (not used yet; kept in case you enable it later)
    let inPlay = Boolean(row.in);
    let tmpScore = row.score;
    let checkoutOnDouble = false;

    const applied: GameDart[] = [];

    for (const d of darts.slice(0, 3)) {
      applied.push(d);

      const { points, isDouble } = dartValue(d);

      // If not "in" yet and double-in is required
      if (!inPlay && s.rules.doubleIn) {
        if (isDouble) {
          inPlay = true;
          row.in = true;
          // no subtraction this dart except the double-in itself? In most rules
          // the double-in dart also scores; so keep subtraction.
        } else {
          // still not in; this dart doesn't score
          continue;
        }
      }

      const nextScore = tmpScore - points;

      // Bust rules:
      // - score < 0 -> bust
      // - double-out enabled and nextScore === 0 must end on double
      // - if nextScore === 1 with double-out -> impossible to finish later; bust if you go below 2? (classic: you can leave 1 but it's immediate bust when you try to reduce below 2 without double)
      if (nextScore < 0) {
        // bust
        tmpScore = row.score; // revert to start-of-turn
        applied.length = applied.length; // keep history of darts thrown anyway
        // stop processing further darts (standard: remaining darts are not thrown)
        break;
      }

      if (nextScore === 0) {
        if (s.rules.doubleOut) {
          if (isDouble) {
            tmpScore = 0;
            checkoutOnDouble = true;
          } else {
            // bust because not finished on a double
            tmpScore = row.score;
          }
        } else {
          tmpScore = 0;
        }
        // end of turn; ignore remaining darts
        break;
      }

      // leave exactly 1 while double-out is true => bust on this dart (you cannot finish later)
      if (s.rules.doubleOut && nextScore === 1) {
        tmpScore = row.score; // bust
        break;
      }

      // normal subtraction
      tmpScore = nextScore;
    }

    // save history (what the player actually threw)
    s.history.push({ playerId: p.id, darts: applied });

    // apply resulting score (or bust fallback)
    row.score = tmpScore;

    // game over?
    if (row.score === 0) {
      s.endedAt = Date.now();
    }

    // advance player/turn
    s.currentPlayerIndex = (s.currentPlayerIndex + 1) % s.players.length;
    if (s.currentPlayerIndex === 0) {
      s.turnIndex += 1;
    }

    return s;
  },

  isGameOver(s: X01State): boolean {
    return s.players.some((p) => s.table[p.id]?.score === 0);
  },

  getWinner(s: X01State): Player | null {
    const winner = s.players.find((p) => s.table[p.id]?.score === 0);
    return winner || null;
  },
};
