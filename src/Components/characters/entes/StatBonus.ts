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
     SB Parsing
  ------------------------------ */

  parseSB(sbText?: string): StatBlock {
    if (!sbText) return { hp: 0, atk: 0, slots: 0 };

    const text = sbText.toLowerCase();

    const extract = (regex: RegExp) => {
      const match = text.match(regex);
      if (!match) return 0;

      const value = match[1] ?? match[2];
      return value ? parseInt(value) : 0;
    };

    return {
      hp: extract(/(?:hp|vida)[^\d+-]*([+-]?\d+)|([+-]?\d+)[^\d]*(?:hp|vida)/),
      atk: extract(/(?:atk|ataque|atq|dmg)[^\d+-]*([+-]?\d+)|([+-]?\d+)[^\d]*(?:atk|ataque|atq|dmg)/),
      slots: extract(/(?:slot|slots|ranura)[^\d+-]*([+-]?\d+)|([+-]?\d+)[^\d]*(?:slot|slots|ranura)/),
    };
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