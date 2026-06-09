// StatBonus.ts

export type StatKey = "hp" | "atk" | "slots";

export interface StatBlock {
  hp: number;
  atk: number;
  slots: number;
}

export interface BonusLog {
  hp: Record<string, number>;
  atk: Record<string, number>;
  slots: Record<string, number>;
}

/* ===============================
   SPECIAL ENTE REGISTRY
================================ */

type SpecialHandler = (
  enteId: string,
  baseBonus: StatBlock,
  context?: any
) => StatBlock;

const specialEnteHandlers: Record<string, SpecialHandler> = {};

export function registerSpecialEnte(
  enteId: string,
  handler: SpecialHandler
) {
  specialEnteHandlers[enteId] = handler;
}

/* ===============================
   MAIN ENGINE
================================ */

export class StatBonusEngine {
  baseStats: StatBlock;
  tempBonus: StatBlock;
  bonusLog: BonusLog;

  constructor(base?: Partial<StatBlock>) {
    this.baseStats = {
      hp: base?.hp ?? 10,
      atk: base?.atk ?? 0,
      slots: base?.slots ?? 15,
    };

    this.tempBonus = {
      hp: 0,
      atk: 0,
      slots: 0,
    };

    this.bonusLog = {
      hp: {},
      atk: {},
      slots: {},
    };
  }

  /* -----------------------------
     SB Parsing  (IMPROVED)
  ------------------------------ */

  parseSB(sbText?: string): StatBlock {
    if (!sbText) return { hp: 0, atk: 0, slots: 0 };

    // ---------- 1. Normalise ----------
    let text = sbText.toLowerCase();

    // Replace addition / subtraction words with explicit + or -
    // Handles "Suma +3", "Suma 3", "Añade +4", "Resta -1", "Resta 1", "Disminuye 2", etc.
    text = text.replace(/\b(?:suma|añade)\s*\+?/gi, "+");
    text = text.replace(/\b(?:resta|disminuye)\s*\-?/gi, "-");

    // ---------- 2. Extract each stat ----------
    // Keyword first (e.g., "HP +1", "HP: +6")
    // Number first (e.g., "+5 HP", "+4 de HP", "+1 ATK") – only whitespace, colon, "de" allowed
    const patterns: Record<StatKey, RegExp> = {
      hp: /(?:hp|vida)\s*:?\s*([+-]?\d+)|([+-]?\d+)\s*(?:de\s+)?:?\s*(?:hp|vida)/,
      atk: /(?:atk|ataque|atq|dmg)\s*:?\s*([+-]?\d+)|([+-]?\d+)\s*(?:de\s+)?:?\s*(?:atk|ataque|atq|dmg)/,
      slots: /(?:slot|slots|ranura)\s*:?\s*([+-]?\d+)|([+-]?\d+)\s*(?:de\s+)?:?\s*(?:slot|slots|ranura)/,
    };

    const result: StatBlock = { hp: 0, atk: 0, slots: 0 };

    (["hp", "atk", "slots"] as StatKey[]).forEach((stat) => {
      const match = text.match(patterns[stat]);
      if (!match) return;

      // Group 1 = keyword‑first capture, Group 2 = number‑first capture
      const value = match[1] ?? match[2];
      if (value) {
        result[stat] = parseInt(value, 10);
      }
    });

    return result;
  }

  /* -----------------------------
     Apply / Remove
  ------------------------------ */

  applyEnte(
    enteId: string,
    sbText: string,
    unlockLevel: number,
    context?: any
  ) {
    if (unlockLevel < 2) {
      this.removeEnte(enteId);
      return;
    }

    let bonus = this.parseSB(sbText);

    if (specialEnteHandlers[enteId]) {
      bonus = specialEnteHandlers[enteId](enteId, bonus, context);
    }

    (["hp", "atk", "slots"] as StatKey[]).forEach((stat) => {
      if (bonus[stat] !== 0) {
        this.bonusLog[stat][enteId] = bonus[stat];
      } else {
        delete this.bonusLog[stat][enteId];
      }
    });
  }

  removeEnte(enteId: string) {
    (["hp", "atk", "slots"] as StatKey[]).forEach((stat) => {
      delete this.bonusLog[stat][enteId];
    });
  }

  setTempBonus(stat: StatKey, value: number) {
    this.tempBonus[stat] = value;
  }

  /* -----------------------------
     Calculation
  ------------------------------ */

  private sumStat(stat: StatKey): number {
    return Object.values(this.bonusLog[stat]).reduce(
      (sum, value) => sum + value,
      0
    );
  }

  getFinalStats(): StatBlock {
    return {
      hp:
        this.baseStats.hp +
        this.sumStat("hp") +
        this.tempBonus.hp,

      atk:
        this.baseStats.atk +
        this.sumStat("atk") +
        this.tempBonus.atk,

      slots:
        this.baseStats.slots +
        this.sumStat("slots") +
        this.tempBonus.slots,
    };
  }

  /* -----------------------------
     UI Table Support
  ------------------------------ */

  getBonusTable() {
    const ids = new Set([
      ...Object.keys(this.bonusLog.hp),
      ...Object.keys(this.bonusLog.atk),
      ...Object.keys(this.bonusLog.slots),
    ]);

    return Array.from(ids).map((enteId) => ({
      enteId,
      hp: this.bonusLog.hp[enteId] ?? 0,
      atk: this.bonusLog.atk[enteId] ?? 0,
      slots: this.bonusLog.slots[enteId] ?? 0,
    }));
  }
}