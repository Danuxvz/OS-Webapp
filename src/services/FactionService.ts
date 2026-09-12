import { supabase } from "./SupaBase";

/* =========================
   FACTION BOONS (read-only)
========================= */

export interface CharacterBoon {
  id: number;
  character_code: string;
  faction_id: string;
  boon_key: string;
  unlocked_at: string;
}

/**
 * Fetches every boon row for a given character code (which matches the
 * `charName` field locally — e.g. "N001", "H033"). The Discord bot is the
 * only writer for this table; the web app treats it as read-only.
 */
export async function fetchCharacterBoons(
  characterCode: string
): Promise<CharacterBoon[]> {
  const code = (characterCode ?? "").trim().toUpperCase();
  if (!code) return [];

  const { data, error } = await supabase
    .from("character_boons")
    .select("id,character_code,faction_id,boon_key,unlocked_at")
    .eq("character_code", code);

  if (error) {
    console.warn("fetchCharacterBoons: query error", error);
    return [];
  }

  return (data ?? []) as CharacterBoon[];
}