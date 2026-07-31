// SpecialEntes.ts
//
// Stat-bonus exceptions: these entes don't use the normal parseSB() text
// parsing at all. Their bonus is computed from how many DISTINCT entes
// the character owns from a given series (E005/E052/E060), in groups of 5.
// The computed value fully REPLACES the parsed bonus (StatBonusEngine.applyEnte
// already does this for anything registered via registerSpecialEnte — it
// does not add the two together). Every other ente keeps using the normal
// text-based parsing untouched.
//
// Import this file once for its side effect (the registerSpecialEnte calls)
// — it's imported by CharacterManager.tsx.

import { registerSpecialEnte, type StatBlock } from "./StatBonus";
import type { CharacterEnte } from "../database/db";

interface SpecialContext {
  entes?: CharacterEnte[];
}

function countDistinctSeries(entes: CharacterEnte[] | undefined, prefix: string): number {
  if (!entes) return 0;
  const seen = new Set<string>();
  for (const e of entes) {
    if (e.isDeleted) continue;
    if ((e.amount ?? 0) <= 0) continue;
    if (e.enteID.toUpperCase().startsWith(prefix)) {
      seen.add(e.enteID.toUpperCase());
    }
  }
  return seen.size;
}

// D003C — +3 Slots por cada 5 Tsuchigumos (E005 series) distintos en tu inventario
registerSpecialEnte("D003C", (_enteId, _baseBonus, context: SpecialContext) => {
  const groups = Math.floor(countDistinctSeries(context?.entes, "E005") / 5);
  return { hp: 0, atk: 0, slots: 3 * groups } as StatBlock;
});

// D046A — +1 HP y +2 Slots por cada 5 Mandrágoras (E052 series) distintas en tu inventario
registerSpecialEnte("D046A", (_enteId, _baseBonus, context: SpecialContext) => {
  const groups = Math.floor(countDistinctSeries(context?.entes, "E052") / 5);
  return { hp: 1 * groups, atk: 0, slots: 2 * groups } as StatBlock;
});

// D047A — +1 Atk y +2 Slots por cada 5 Kobolds Dragonkin (E060 series) distintos en tu inventario
registerSpecialEnte("D047A", (_enteId, _baseBonus, context: SpecialContext) => {
  const groups = Math.floor(countDistinctSeries(context?.entes, "E060") / 5);
  return { hp: 0, atk: 1 * groups, slots: 2 * groups } as StatBlock;
});
