// ============================================
// src/lib/gameEngines/index.ts
// ============================================
import type { GameEngine, MatchRules } from "../types-game";
import { X01Engine } from "./x01Engine";
import { CricketEngine } from "./cricketEngine";
import { KillerEngine } from "./killerEngine";
import { ShanghaiEngine } from "./shanghaiEngine";

export function getEngine(mode: MatchRules["mode"]): GameEngine<any> {
  switch (mode) {
    case "x01": return X01Engine;
    case "cricket": return CricketEngine;
    case "killer": return KillerEngine;
    case "shanghai": return ShanghaiEngine;
    default: return X01Engine;
  }
}

export { X01Engine, CricketEngine, KillerEngine, ShanghaiEngine };
