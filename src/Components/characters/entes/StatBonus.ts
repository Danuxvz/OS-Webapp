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

    // Normalise Spanish words to explicit + / -
    let text = sbText.toLowerCase();
    text = text.replace(/\b(?:suma|añade)\s*\+?/gi, "+");
    text = text.replace(/\b(?:resta|disminuye)\s*\-?/gi, "-");

    const result: StatBlock = { hp: 0, atk: 0, slots: 0 };

    // Keyword maps
    const statAliases: Record<string, StatKey> = {
      hp: "hp",
      vida: "hp",
      atk: "atk",
      ataque: "atk",
      atq: "atk",
      dmg: "atk",
      slot: "slots",
      slots: "slots",
      ranura: "slots",
    };

    // Number-first or keyword-first, global matching
    const pattern =
      /([+-]?\d+)\s*(?:de\s+)?:?\s*(hp|vida|atk|ataque|atq|dmg|slot|slots|ranura)|(hp|vida|atk|ataque|atq|dmg|slot|slots|ranura)\s*:?\s*([+-]?\d+)/gi;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      let valueStr: string | undefined;
      let statKey: StatKey | undefined;

      // Number-first: group1 = value, group2 = stat
      if (match[1] && match[2]) {
        valueStr = match[1];
        statKey = statAliases[match[2].toLowerCase()];
      }
      // Keyword-first: group3 = stat, group4 = value
      else if (match[3] && match[4]) {
        statKey = statAliases[match[3].toLowerCase()];
        valueStr = match[4];
      }

      if (statKey && valueStr !== undefined) {
        const value = parseInt(valueStr, 10);
        result[statKey] += value;
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