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
  if (!sbText) {
    return { hp: 0, atk: 0, slots: 0 };
  }

  let text = sbText.toLowerCase();

  // normalize aliases
  text = text
    .replace(/ataque/g, "atk")
    .replace(/\batq\b/g, "atk")
    .replace(/\bdmg\b/g, "atk")
    .replace(/\bvida\b/g, "hp")
    .replace(/\bslo\b/g, "slot")
    .replace(/\branuras?\b/g, "slot")
    .replace(/\bslots?\b/g, "slot");

  text = text.replace(/(\d+)\s*\+\s*(atk|hp|slot)/g, "+$1 $2");

  const result: StatBlock = {
    hp: 0,
    atk: 0,
    slots: 0,
  };

  const patterns = [
    /(atk|hp|slot)\s*:?\s*([+-]\d+)/g,
    /([+-]\d+)\s*(atk|hp|slot)/g,
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const stat =
        pattern === patterns[0]
          ? match[1]
          : match[2];

      const value = parseInt(
        pattern === patterns[0]
          ? match[2]
          : match[1],
        10
      );

      switch (stat) {
        case "atk":
          result.atk += value;
          break;

        case "hp":
          result.hp += value;
          break;

        case "slot":
          result.slots += value;
          break;
      }
    }
  }

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