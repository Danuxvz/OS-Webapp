import { supabase } from "./SupaBase.ts";
import { db } from "../Components/characters/database/db";
import { characterManager } from "../Components/characters/CharacterManager";

export const DARUMA_IDS = [
  "E123A",
  "E123B",
  "E123C",
  "E123D",
  "E123E",
  "E123F",
  "E123G",
  "E123H",
  "E123I",
  "E123J",
] as const;

const DARUMA_RE = /^E123[A-J]$/i;
const DAILY_LIMIT = 3;

function getCharacterCode(externalId?: string | null) {
  const code = externalId?.split("::")[1]?.trim().toUpperCase();
  if (!code) throw new Error("This character does not have a valid external ID.");
  return code;
}

function pickRandomDaruma(exclude: string) {
  const pool = DARUMA_IDS.filter((id) => id !== exclude.toUpperCase());
  return pool[Math.floor(Math.random() * pool.length)];
}

function getDayStartIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

async function countDarumaUses(characterCode: string, sourceEnte: string) {
  const startIso = getDayStartIso();
  const { count, error } = await supabase
    .from("daruma_transactions")
    .select("id", { count: "exact", head: true })
    .eq("character_code", characterCode)
    .eq("source_ente", sourceEnte)
    .gte("created_at", startIso)
    .in("status", ["pending", "processing", "completed"]);

  if (error) {
    console.warn("countDarumaUses error:", error);
    return 0;
  }
  return count ?? 0;
}

export async function randomizeDarumaForCharacter(
  characterId: number,
  sourceEnteID: string
) {
  const character = await db.characters.get(characterId);
  if (!character?.externalId) {
    throw new Error("Daruma randomization requires a character with an external ID.");
  }
  if (!DARUMA_RE.test(sourceEnteID)) {
    throw new Error("That ente is not a Daruma.");
  }

  const characterCode = getCharacterCode(character.externalId);
  const usesToday = await countDarumaUses(characterCode, sourceEnteID);
  if (usesToday >= DAILY_LIMIT) {
    throw new Error(`That Daruma has already been randomized ${DAILY_LIMIT} times today.`);
  }

  const source = await db.entes
    .where("[characterId+enteID]")
    .equals([characterId, sourceEnteID])
    .first();

  if (!source || source.isDeleted) {
    throw new Error("Daruma not found in inventory.");
  }

  const targetEnteID = pickRandomDaruma(sourceEnteID);
  const targetRaw = await db.entes
    .where("[characterId+enteID]")
    .equals([characterId, targetEnteID])
    .first();
  const target = targetRaw && !targetRaw.isDeleted ? targetRaw : null;

  const now = Date.now();
  const sourceAmount = source.amount ?? 0;
  const targetAmount = target?.amount ?? 0;

  // Perform the local swap via CharacterManager
  await characterManager.randomizeDaruma(characterId, sourceEnteID, targetEnteID);

  // Enqueue the bot task
  const { error } = await supabase.from("daruma_transactions").insert({
    character_id: characterId,
    character_code: characterCode,
    guild_id: null,
    source_ente: sourceEnteID,
    target_ente: targetEnteID,
    source_amount: sourceAmount,
    target_amount: targetAmount,
    status: "pending",
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  });

  if (error) {
    console.warn("daruma transaction insert failed:", error);
  }

  return { characterId, characterCode, sourceEnteID, targetEnteID, sourceAmount, targetAmount };
}