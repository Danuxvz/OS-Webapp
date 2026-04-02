import { supabase, getRemoteUserId, getDiscordId } from "./SupaBase.ts";
import { db } from "../Components/characters/database/db";

/* =========================
   UTIL
========================= */

function makeExternalId(ownerId: string, name: string) {
  return `${ownerId}::${name.trim().toLowerCase()}`;
}

function parseInventoryBlob(blob: string) {
  const result: Record<string, number> = {};
  if (!blob) return result;

  const entries = blob.split(",");

  for (const entry of entries) {
    const match = entry.match(/^(.+?)x(\d+)$/);
    if (!match) continue;

    const id = match[1].trim();
    const amount = Number(match[2]);

    result[id] = amount;
  }

  return result;
}

/* =========================
   PUSH LOCAL → SUPABASE
========================= */

export async function pushLocalChanges() {
  const remoteUserId = getRemoteUserId();
  if (!remoteUserId) return;

  const dirtyCharacters = await db.characters
    .filter((c) => c.isDirty)
    .toArray();

  for (const char of dirtyCharacters) {
    try {
      /* =========================
           UPSERT CHARACTER
      ========================= */

      const charPayload: any = {
        user_id: remoteUserId,
        char_name: char.charName,
        base_stats: char.baseStats,
        bonus_log: char.bonusLog,
        temp_stat_bonus: char.tempStatBonus,
        charImage: char.charImage,
        history_sum: char.historySum,
        schema_version: char.schemaVersion,
        updated_at: new Date(char.updatedAt).toISOString(),
        source: char.source ?? "web",
      };

      // Only include external_id if it exists (exported characters only)
      if (char.externalId) {
        charPayload.external_id = char.externalId;
      }

      // If we already have remoteId → use it
      if (char.remoteId) {
        charPayload.id = char.remoteId;
      }

      const conflictField = char.externalId ? "external_id" : "id";

      const charUpsert = await supabase
        .from("characters")
        .upsert(charPayload, { onConflict: conflictField })
        .select()
        .single();

      if (charUpsert.error) {
        console.warn(
          "pushLocalChanges: character upsert error",
          charUpsert.error
        );
        continue;
      }

      const remoteCharId = char.remoteId ?? charUpsert.data.id;

      // Save remoteId locally if first insert
      if (!char.remoteId && remoteCharId) {
        await db.characters.update(char.id!, {
          remoteId: remoteCharId,
        });
      }

      /* =========================
           UPSERT ENTES
      ========================= */

      if (!remoteCharId) continue;

      const localEntes = await db.entes
        .where("characterId")
        .equals(char.id!)
        .toArray();

      if (localEntes.length > 0) {
        const uniqueMap = new Map<string, any>();

        for (const ente of localEntes) {
          const key = `${remoteCharId}_${ente.enteID}`;

          uniqueMap.set(key, {
            character_id: remoteCharId,
            ente_id: ente.enteID,
            amount: ente.amount,
            favorite: ente.favorite,
            order: ente.order,
            unlock_level: ente.unlockLevel,
            notes: ente.notes ?? null,
            custom_image: ente.customImage ?? null,
            updated_at: new Date(ente.updatedAt).toISOString(),
          });
        }

        const enteRecords = Array.from(uniqueMap.values());

        const entesUpsert = await supabase
          .from("entes")
          .upsert(enteRecords, { onConflict: "character_id,ente_id" });

        if (entesUpsert.error) {
          console.warn(
            "pushLocalChanges: entes upsert error",
            entesUpsert.error
          );
        }
      }

      /* =========================
           UPSERT INVENTORY
      ========================= */

      const inv = await db.inventory
        .where("characterId")
        .equals(char.id!)
        .first();

      if (inv) {
        const invPayload: any = {
          character_id: remoteCharId,
          cards: inv.cards,
          consumables: inv.consumables,
          updated_at: new Date(inv.updatedAt).toISOString(),
        };

        if (inv.remoteId) {
          invPayload.id = inv.remoteId;
        }

        const invUpsert = await supabase
          .from("inventory")
          .upsert(invPayload, { onConflict: "character_id" })
          .select()
          .single();

        if (invUpsert.error) {
          console.warn(
            "pushLocalChanges: inventory upsert error",
            invUpsert.error
          );
        } else if (!inv.remoteId && invUpsert.data?.id) {
          await db.inventory.update(inv.id!, {
            remoteId: invUpsert.data.id,
          });
        }
      }

      /* =========================
           LOADOUTS (DELETE + UPSERT)
      ========================= */

      const localLoadouts = await db.loadouts
        .where("characterId")
        .equals(char.id!)
        .toArray();

      // Delete soft-deleted loadouts from remote
      const deleted = localLoadouts.filter((l) => l.isDeleted);
      for (const l of deleted) {
        const { error } = await supabase
          .from("loadouts")
          .delete()
          .eq("character_id", remoteCharId)
          .eq("name", l.name);

        if (!error) {
          await db.loadouts.delete(l.id!);
        } else {
          console.warn("Failed to delete loadout", l.name, error);
        }
      }

      // Upsert active loadouts
      const active = localLoadouts.filter((l) => !l.isDeleted);
      if (active.length > 0 && remoteCharId) {
        const records = active.map((l) => ({
          character_id: remoteCharId,
          name: l.name,
          hp: l.data.hp,
          atk: l.data.atk,
          weapon: l.data.weapon,
          habilidades_pasivas: l.data.habilidadesPasivas?.selectedIds ?? [], // ✅ FIX: send only selectedIds array
          armor_class: l.data.armorClass,
          slots: l.data.slots,
          notes: l.data.notes ?? null,
          updated_at: new Date(l.updatedAt).toISOString(),
        }));

        const { error } = await supabase
          .from("loadouts")
          .upsert(records, { onConflict: "character_id,name" });

        if (error) {
          console.warn("pushLocalChanges: loadouts upsert error", error);
        }
      }

      /* =========================
           MARK SYNCED
      ========================= */

      await db.characters.update(char.id!, {
        isDirty: false,
      });
    } catch (err) {
      console.error(
        "pushLocalChanges: unexpected error syncing",
        char.charName,
        err
      );
    }
  }
}

export async function deleteRemoteCharacter(localCharId: number) {
  const localChar = await db.characters.get(localCharId);
  if (!localChar || !localChar.remoteId) return;

  const charId = localChar.remoteId;

  try {
    // Delete character remotely
    const { error: charError } = await supabase
      .from("characters")
      .delete()
      .eq("id", charId);

    if (charError) {
      console.warn(
        "Failed to delete remote character",
        localChar.charName,
        charError
      );
    }

    // Delete related remote entes
    const { error: entesError } = await supabase
      .from("entes")
      .delete()
      .eq("character_id", charId);

    if (entesError) {
      console.warn(
        "Failed to delete remote entes for",
        localChar.charName,
        entesError
      );
    }

    // Delete remote inventory
    const { error: invError } = await supabase
      .from("inventory")
      .delete()
      .eq("character_id", charId);

    if (invError) {
      console.warn(
        "Failed to delete remote inventory for",
        localChar.charName,
        invError
      );
    }

    // Delete remote loadouts
    const { error: loadoutError } = await supabase
      .from("loadouts")
      .delete()
      .eq("character_id", charId);

    if (loadoutError) {
      console.warn(
        "Failed to delete remote loadouts for",
        localChar.charName,
        loadoutError
      );
    }

    console.info(
      "Deleted remote character and related data:",
      localChar.charName
    );
  } catch (err) {
    console.error("deleteRemoteCharacter unexpected error:", err);
  }
}

/* =========================
   PULL EXPORT TABLE
========================= */

export async function pullCharactersExport() {
  const remoteUserId = getRemoteUserId();
  const discordId = getDiscordId();
  if (!remoteUserId || !discordId) return;

  const { data: exports } = await supabase
    .from("characters_export")
    .select("*")
    .eq("owner_id", discordId);

  if (!exports) return;

  const CARD_IDS = [
    "AE_Card",
    "Basic_Attack",
    "Ethrielle",
    "Engaar",
    "Halagar",
    "Interpretar",
    "Intimidar",
    "Negociar",
    "Persuadir",
    "Rogar",
    "Seducir",
    "Sobornar",
  ];
  const CONSUMABLE_IDS = [
    "KudagiBento",
    "AstralDoguBento",
    "GetStrongBento",
    "ScarletSpectralMiso",
    "ShellSushi",
    "SpicyFireRamen",
    "MomijiManju",
    "MochisDeBaku",
    "TaiyakiKijyo",
  ];

  for (const exp of exports) {
    const externalId = makeExternalId(exp.owner_id, exp.name);

    let localChar = await db.characters
      .where("externalId")
      .equals(externalId)
      .first();

    if (!localChar) {
      const id = await db.characters.add({
        discordId,
        remoteId: undefined,
        externalId,
        source: "external",
        charName: exp.name,
        charImage: exp.image ?? "",
        baseStats: { hp: 10, atk: 0, slots: 15 },
        bonusLog: { hp: {}, atk: {}, slots: {} },
        tempStatBonus: { hp: 0, atk: 0, slots: 0 },
        historySum: 0,
        schemaVersion: 1,
        updatedAt: Date.now(),
        isDirty: true,
      });

      localChar = await db.characters.get(id);
    }

    // --- Parse inventory blob into simple map: id -> amount
    const parsedInventory = parseInventoryBlob(exp.inventory);

    const localEntes = await db.entes
      .where("characterId")
      .equals(localChar!.id!)
      .toArray();

    const existingMap = new Map<string, (typeof localEntes)[number]>();
    for (const e of localEntes) existingMap.set(e.enteID, e);

    let inventory = await db.inventory
      .where("characterId")
      .equals(localChar!.id!)
      .first();

    if (!inventory) {
      const invId = await db.inventory.add({
        characterId: localChar!.id!,
        cards: {},
        consumables: {},
        updatedAt: Date.now(),
        isDirty: true,
      });
      inventory = await db.inventory.get(invId);
    }

    if (!inventory!.cards) inventory!.cards = {};
    if (!inventory!.consumables) inventory!.consumables = {};

    const normalize = (s: string) =>
      String(s || "")
        .toLowerCase()
        .replace(/[\s:_\-]+/g, "");

    // --- Distribute parsed items into inventory OR entes ---
    for (const [rawId, amount] of Object.entries(parsedInventory)) {
      const normalized = normalize(rawId);

      // Check if it matches a card id
      const cardMatch = CARD_IDS.find((c) => normalize(c) === normalized);
      if (cardMatch) {
        inventory!.cards[cardMatch] = amount;
        continue;
      }

      // Check if it matches a consumable id
      const consumableMatch = CONSUMABLE_IDS.find(
        (c) => normalize(c) === normalized
      );
      if (consumableMatch) {
        inventory!.consumables[consumableMatch] = amount;
        continue;
      }

      // Otherwise treat as an ente id
      const existing = existingMap.get(rawId);
      if (existing) {
        await db.entes.update(existing.id!, {
          amount,
          updatedAt: Date.now(),
          isDirty: true,
        });
      } else {
        await db.entes.add({
          characterId: localChar!.id!,
          enteID: rawId,
          amount,
          unlockLevel: 0,
          favorite: false,
          order: Date.now(),
          notes: "",
          customImage: "",
          updatedAt: Date.now(),
          isDirty: true,
        });
      }
    }

    await db.inventory.update(inventory!.id!, {
      cards: inventory!.cards,
      consumables: inventory!.consumables,
      updatedAt: Date.now(),
      isDirty: true,
    });

    // Zero out missing entes (only those that were localEntes at start)
    for (const ente of localEntes) {
      if (!parsedInventory[ente.enteID]) {
        await db.entes.update(ente.id!, {
          amount: 0,
          updatedAt: Date.now(),
          isDirty: true,
        });
      }
    }

    const newName =
      !localChar!.charName || localChar!.charName.trim() === ""
        ? exp.name
        : localChar!.charName;

    const newImage =
      !localChar!.charImage || localChar!.charImage.trim() === ""
        ? exp.image ?? ""
        : localChar!.charImage;

    await db.characters.update(localChar!.id!, {
      charName: newName,
      charImage: newImage,
      updatedAt: Date.now(),
      isDirty: true,
    });

    console.info(
      `pullCharactersExport: synced character "${localChar!.charName}" with export "${exp.name}"`
    );
  }
}

async function fetchOldUserRow(discordId: string) {
  // Try plural then singular table names so migration is resilient across projects
  const candidates = ["user_data"];

  for (const tableName of candidates) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("discord_id", discordId)
        .single();

      if (error) {
        // If table doesn't exist, PostgREST returns a PostgREST error; skip to next
        // log for debugging but don't throw
        console.warn(
          `fetchOldUserRow: no data from ${tableName}:`,
          error.message ?? error
        );
        continue;
      }

      // If no row found, data will be null; return null to caller
      if (!data) return null;

      // success
      return data;
    } catch (e) {
      // network/other unexpected error — warn and continue
      console.warn(`fetchOldUserRow: fetch failed for ${tableName}:`, e);
      continue;
    }
  }

  // nothing found in either table
  return null;
}

async function migrateOldUserDataIfNeeded() {
  const discordId = getDiscordId();
  if (!discordId) return;

  const user = await db.users.get(discordId);
  if (user?.migratedFromBlob) return; // already migrated

  // try to fetch the old row from either possible table
  const oldRow = await fetchOldUserRow(discordId);
  if (!oldRow) {
    console.info(
      "migrateOldUserDataIfNeeded: no old user row found, skipping migration"
    );
    return;
  }

  // oldRow.data may be:
  // - an object (json/ jsonb column)
  // - a string with raw JSON
  // - a CSV-escaped JSON string (quoted, inner quotes doubled) like in your export
  let raw = oldRow.data;
  if (raw == null) {
    console.info(
      "migrateOldUserDataIfNeeded: old data is null/undefined, skipping"
    );
    return;
  }

  let parsed: any = null;

  // If it's already an object, use it
  if (typeof raw === "object") {
    parsed = raw;
  } else if (typeof raw === "string") {
    // Clean up common CSV quoting artifacts and whitespace
    let s = raw.trim();

    // If the string is wrapped in quotes (e.g. starts with " and ends with "), remove them
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1);
    }

    // CSV exports often double double-quotes to escape them — replace "" with "
    // Only do this replacement if it appears to be CSV-escaped JSON (heuristic)
    if (s.includes('""')) {
      s = s.replace(/""/g, '"');
    }

    // Now attempt to parse
    try {
      parsed = JSON.parse(s);
    } catch (err) {
      console.warn(
        "migrateOldUserDataIfNeeded: failed to parse old data after cleaning. Sample start:",
        s.slice(0, 200)
      );
      // Give up gracefully — do not throw. Mark migrated to avoid retry loops if you want,
      // or just skip marking so you can debug later. Here we skip migration.
      return;
    }
  } else {
    console.warn(
      "migrateOldUserDataIfNeeded: unexpected old data type:",
      typeof raw
    );
    return;
  }

  // If parsing succeeded but parsed is falsy, bail out
  if (!parsed) {
    console.warn("migrateOldUserDataIfNeeded: parsed is falsy, skipping");
    return;
  }

  /* =========================
       FIND TARGET CHARACTER
  ========================= */
  const localCharacters = await db.characters
    .where("discordId")
    .equals(discordId)
    .toArray();

  if (localCharacters.length === 0) {
    console.info(
      "migrateOldUserDataIfNeeded: no local characters to merge into, skipping"
    );
    // optionally: create a new character here if you want
    await db.users.put({
      discordId,
      updatedAt: Date.now(),
      isDirty: false,
      migratedFromBlob: true,
      remoteId: user?.remoteId,
    });
    return;
  }

  let targetChar = localCharacters[0];

  if (localCharacters.length > 1 && parsed.name) {
    const match = localCharacters.find(
      (c) => c.charName.toLowerCase() === String(parsed.name).toLowerCase()
    );
    if (match) targetChar = match;
  }

  /* =========================
      MERGE ENTE DATA
  ========================= */

  if (Array.isArray(parsed.entes)) {
    for (const oldEnte of parsed.entes) {
      if (!oldEnte?.id) continue;

      const existing = await db.entes
        .where("[characterId+enteID]")
        .equals([targetChar.id!, oldEnte.id])
        .first();

      const next = {
        amount: oldEnte.amount ?? 0,
        unlockLevel: oldEnte.unlockLevel ?? 0,
        notes: oldEnte.notes ?? "",
        customImage: oldEnte.image ?? "",
        favorite: oldEnte.favorite ?? false,
        order: oldEnte.order ?? Date.now(),
        updatedAt: Date.now(),
        isDirty: true,
      };

      if (existing) {
        await db.entes.update(existing.id!, next);
      } else {
        await db.entes.add({
          characterId: targetChar.id!,
          enteID: oldEnte.id,
          ...next,
        });
      }
    }

    // Also update the character name from export
    await db.characters.update(targetChar.id!, {
      charName: parsed.name ?? targetChar.charName,
      isDirty: true,
      updatedAt: Date.now(),
    });
  }

  /* =========================
       MARK MIGRATED
  ========================= */

  await db.users.put({
    discordId,
    updatedAt: Date.now(),
    isDirty: false,
    migratedFromBlob: true,
    remoteId: user?.remoteId,
  });

  console.info("migrateOldUserDataIfNeeded: migration complete for", discordId);
}

/* =========================
   PULL NORMAL CHARACTERS
========================= */

async function pullRemoteEntes() {
  const remoteUserId = getRemoteUserId();
  if (!remoteUserId) return;

  // Get all remote characters first
  const { data: remoteChars } = await supabase
    .from("characters")
    .select("id")
    .eq("user_id", remoteUserId);

  if (!remoteChars) return;

  for (const remoteChar of remoteChars) {
    // Find local character by remoteId
    const localChar = await db.characters
      .where("remoteId")
      .equals(remoteChar.id)
      .first();

    if (!localChar) continue;

    // Pull entes for this character
    const { data: remoteEntes } = await supabase
      .from("entes")
      .select("*")
      .eq("character_id", remoteChar.id);

    if (!remoteEntes) continue;

    for (const remote of remoteEntes) {
      const existing = await db.entes
        .where("[characterId+enteID]")
        .equals([localChar.id!, remote.ente_id])
        .first();

      const remoteTime = new Date(remote.updated_at).getTime();

      if (!existing) {
        await db.entes.add({
          characterId: localChar.id!,
          enteID: remote.ente_id,
          amount: remote.amount,
          unlockLevel: remote.unlock_level,
          favorite: remote.favorite,
          order: remote.order,
          notes: remote.notes ?? "",
          customImage: remote.custom_image ?? "",
          updatedAt: remoteTime,
          isDirty: false,
        });
      } else {
        if (remoteTime > existing.updatedAt) {
          await db.entes.update(existing.id!, {
            amount: remote.amount,
            unlockLevel: remote.unlock_level,
            favorite: remote.favorite,
            order: remote.order,
            notes: remote.notes ?? "",
            customImage: remote.custom_image ?? "",
            updatedAt: remoteTime,
            isDirty: false,
          });
        }
      }
    }
  }
}

/* =========================
   PULL REMOTE LOADOUTS
========================= */

async function pullRemoteLoadouts() {
  const remoteUserId = getRemoteUserId();
  if (!remoteUserId) return;

  // Get all remote characters
  const { data: remoteChars } = await supabase
    .from("characters")
    .select("id")
    .eq("user_id", remoteUserId);

  if (!remoteChars) return;

  for (const remoteChar of remoteChars) {
    const localChar = await db.characters
      .where("remoteId")
      .equals(remoteChar.id)
      .first();

    if (!localChar) continue;

    const { data: remoteLoadouts } = await supabase
      .from("loadouts")
      .select("*")
      .eq("character_id", remoteChar.id);

    if (!remoteLoadouts) continue;

    for (const remote of remoteLoadouts) {
      const existing = await db.loadouts
        .where("[characterId+name]")
        .equals([localChar.id!, remote.name])
        .first();

      const remoteTime = new Date(remote.updated_at).getTime();

      const mapped = {
        characterId: localChar.id!,
        name: remote.name,
        data: {
          hp: remote.hp,
          atk: remote.atk,
          weapon: remote.weapon,
          // ✅ FIX: reconstruct LoadoutHE object from the array
          habilidadesPasivas: {
            max: 2, // default; can be adjusted later
            selectedIds: remote.habilidades_pasivas ?? [],
          },
          armorClass: remote.armor_class,
          slots: remote.slots,
          notes: remote.notes ?? "",
        },
        updatedAt: remoteTime,
        isDirty: false,
      };

      if (!existing) {
        await db.loadouts.add(mapped);
      } else if (remoteTime > existing.updatedAt) {
        await db.loadouts.update(existing.id!, mapped);
      }
    }
  }
}

async function pullRemoteCharacters() {
  const remoteUserId = getRemoteUserId();
  if (!remoteUserId) return;

  const { data: remoteChars } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", remoteUserId);

  if (!remoteChars) return;

  for (const remote of remoteChars) {
    const local = await db.characters
      .where("remoteId")
      .equals(remote.id)
      .first();

    const remoteTime = new Date(remote.updated_at).getTime();

    if (!local) {
      await db.characters.add({
        remoteId: remote.id,
        discordId: getDiscordId()!,
        externalId: remote.external_id ?? null,
        charName: remote.char_name,
        baseStats: remote.base_stats,
        bonusLog: remote.bonus_log,
        tempStatBonus: remote.temp_stat_bonus,
        charImage: remote.charImage,
        historySum: remote.history_sum,
        schemaVersion: remote.schema_version,
        updatedAt: remoteTime,
        isDirty: false,
      });
      continue;
    }

    if (remoteTime > local.updatedAt) {
      await db.characters.update(local.id!, {
        charName: remote.char_name,
        baseStats: remote.base_stats,
        bonusLog: remote.bonus_log,
        tempStatBonus: remote.temp_stat_bonus,
        charImage: remote.charImage,
        historySum: remote.history_sum,
        schemaVersion: remote.schema_version,
        updatedAt: remoteTime,
        isDirty: false,
      });
    }
  }
  await pullRemoteEntes();
  await pullRemoteLoadouts();
}

/* =========================
   MASTER SYNC
========================= */

export async function syncAll() {
  await pullRemoteCharacters();
  await pullCharactersExport();
  await migrateOldUserDataIfNeeded();
  await pushLocalChanges();
}