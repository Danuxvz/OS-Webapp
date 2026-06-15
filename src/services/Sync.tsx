import { supabase, getRemoteUserId, getDiscordId } from "./SupaBase.ts";
import { db } from "../Components/characters/database/db";
import type { Character } from "../Components/characters/database/db";

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
   DUPLICATE CLEANUP (LOCAL ONLY)
========================= */

async function deduplicateCharacters() {
  const allChars = await db.characters.toArray();

  // Group by externalId
  const groups = new Map<string, Character[]>();
  for (const c of allChars) {
    if (!c.externalId) continue;
    if (!groups.has(c.externalId)) groups.set(c.externalId, []);
    groups.get(c.externalId)!.push(c);
  }

  for (const chars of groups.values()) {
    if (chars.length <= 1) continue;

    // Prefer the one with the current user's discordId, else the latest updated
    const currentDiscordId = getDiscordId();
    let keeper: Character | undefined =
      chars.find(c => c.discordId === currentDiscordId) ?? chars[0];

    for (const c of chars) {
      if ((c.updatedAt ?? 0) > (keeper?.updatedAt ?? 0)) {
        keeper = c;
      }
    }

    if (!keeper) continue;

    // Process each duplicate – move entes/loadouts, then delete duplicate
    for (const dup of chars) {
      if (dup.id === keeper.id) continue;

      // ----- Move local entes -----
      const entes = await db.entes.where({ characterId: dup.id }).toArray();
      for (const ente of entes) {
        const existing = await db.entes
          .where("[characterId+enteID]")
          .equals([keeper.id!, ente.enteID])
          .first();

        if (!existing) {
          await db.entes.update(ente.id!, {
            characterId: keeper.id!,
            updatedAt: Date.now(),
            isDirty: true,
          });
        } else {
          // Merge notes/customImage if keeper's entry is empty
          let shouldUpdate = false;
          const updateData: any = { updatedAt: Date.now(), isDirty: true };
          if (!existing.notes && ente.notes) {
            updateData.notes = ente.notes;
            shouldUpdate = true;
          }
          if (!existing.customImage && ente.customImage) {
            updateData.customImage = ente.customImage;
            shouldUpdate = true;
          }
          if (shouldUpdate) {
            await db.entes.update(existing.id!, updateData);
          }
          await db.entes.delete(ente.id!);
        }
      }

      // ----- Move loadouts -----
      const loadouts = await db.loadouts.where({ characterId: dup.id }).toArray();
      for (const l of loadouts) {
        await db.loadouts.update(l.id!, {
          characterId: keeper.id!,
          updatedAt: Date.now(),
          isDirty: true,
        });
      }

      // Delete duplicate's local inventory (keeper's inventory is kept)
      await db.inventory.where({ characterId: dup.id }).delete();

      // Delete duplicate local character
      await db.characters.delete(dup.id!);
    }

    // Mark keeper dirty so it gets pushed to remote
    await db.characters.update(keeper.id!, {
      updatedAt: Date.now(),
      isDirty: true,
    });
  }
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

      if (char.externalId) {
        charPayload.external_id = char.externalId;
      }

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

      if (localEntes.length > 0 && remoteCharId) {
        const deletedEntes = localEntes.filter(e => e.isDeleted);
        const activeEntes = localEntes.filter(e => !e.isDeleted);

        // Soft‑delete on remote: update is_deleted = true instead of deleting the row
        for (const ente of deletedEntes) {
          const { error } = await supabase
            .from("entes")
            .update({ is_deleted: true, updated_at: new Date().toISOString() })
            .eq("character_id", remoteCharId)
            .eq("ente_id", ente.enteID);

          if (!error) {
            await db.entes.update(ente.id!, {
              isDirty: false,
              updatedAt: Date.now(),
            });
          } else {
            console.warn(
              "pushLocalChanges: failed to mark ente deleted",
              ente.enteID,
              error
            );
          }
        }

        if (activeEntes.length > 0) {
          const uniqueMap = new Map<string, any>();

          for (const ente of activeEntes) {
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
              is_deleted: false,
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
          customItems: inv.customItems ?? [],
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
           LOADOUTS
      ========================= */

      const localLoadouts = await db.loadouts
        .where("characterId")
        .equals(char.id!)
        .toArray();

      const deleted = localLoadouts.filter((l) => l.isDeleted);
      for (const l of deleted) {
        if (l.remoteId) {
          const { error } = await supabase
            .from("loadouts")
            .delete()
            .eq("id", l.remoteId);
          if (!error) {
            await db.loadouts.delete(l.id!);
          } else {
            console.warn("Failed to delete loadout", l.name, error);
          }
        } else {
          await db.loadouts.delete(l.id!);
        }
      }

      if (remoteCharId) {
        const active = localLoadouts.filter((l) => !l.isDeleted);
        const existingLoadouts = active.filter((l) => l.remoteId);
        const newLoadouts = active.filter((l) => !l.remoteId);

        if (existingLoadouts.length > 0) {
          const existingRecords = existingLoadouts.map((l) => ({
            id: l.remoteId,
            character_id: remoteCharId,
            name: l.name,
            hp: l.data.hp,
            atk: l.data.atk,
            weapon: l.data.weapon,
            habilidades_pasivas: l.data.habilidadesPasivas?.selectedIds ?? [],
            armor_class: l.data.armorClass,
            slots: l.data.slots,
            notes: l.data.notes ?? null,
            updated_at: new Date(l.updatedAt).toISOString(),
          }));

          const { error } = await supabase
            .from("loadouts")
            .upsert(existingRecords, { onConflict: "id" });

          if (error) {
            console.warn("pushLocalChanges: loadouts upsert error", error);
          }
        }

        if (newLoadouts.length > 0) {
          const newRecords = newLoadouts.map((l) => ({
            character_id: remoteCharId,
            name: l.name,
            hp: l.data.hp,
            atk: l.data.atk,
            weapon: l.data.weapon,
            habilidades_pasivas: l.data.habilidadesPasivas?.selectedIds ?? [],
            armor_class: l.data.armorClass,
            slots: l.data.slots,
            notes: l.data.notes ?? null,
            updated_at: new Date(l.updatedAt).toISOString(),
          }));

          const { data: inserted, error } = await supabase
            .from("loadouts")
            .insert(newRecords)
            .select();

          if (error) {
            console.warn("pushLocalChanges: loadouts insert error", error);
          } else if (inserted) {
            for (const remote of inserted) {
              const local = newLoadouts.find(
                (l) => l.name === remote.name && l.characterId === char.id
              );
              if (local) {
                await db.loadouts.update(local.id!, {
                  remoteId: remote.id,
                });
              }
            }
          }
        }
      }

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

    if (localChar) {
      // Reassign to current user if it was imported under a wrong discordId
      if (localChar.discordId !== getDiscordId()) {
        await db.characters.update(localChar.id!, {
          discordId: getDiscordId()!,
          updatedAt: Date.now(),
          isDirty: true,
        });
        localChar = await db.characters.get(localChar.id!);
      }
    } else {
      const id = await db.characters.add({
        discordId: getDiscordId()!,
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

    if (localChar!.externalId && localChar!.source !== "external") {
      await db.characters.update(localChar!.id!, {
        source: "external",
        isDirty: true,
      });
    }

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
        customItems: [],
        updatedAt: Date.now(),
        isDirty: true,
      });
      inventory = await db.inventory.get(invId);
    }

    if (!inventory!.cards) inventory!.cards = {};
    if (!inventory!.consumables) inventory!.consumables = {};
    if (!Array.isArray(inventory!.customItems)) inventory!.customItems = [];

    const normalize = (s: string) =>
      String(s || "")
        .toLowerCase()
        .replace(/[\s:_\-]+/g, "");

    for (const [rawId, amount] of Object.entries(parsedInventory)) {
      const normalized = normalize(rawId);

      const cardMatch = CARD_IDS.find((c) => normalize(c) === normalized);
      if (cardMatch) {
        inventory!.cards[cardMatch] = amount;
        continue;
      }

      const consumableMatch = CONSUMABLE_IDS.find(
        (c) => normalize(c) === normalized
      );
      if (consumableMatch) {
        inventory!.consumables[consumableMatch] = amount;
        continue;
      }

      const existing = existingMap.get(rawId);
      if (existing) {
        if (existing.amount !== amount) {
          await db.entes.update(existing.id!, {
            amount,
            updatedAt: Date.now(),
            isDirty: true,
          });
        }
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

    for (const ente of localEntes) {
      if (!parsedInventory[ente.enteID] && ente.amount !== 0) {
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

/* =========================
   PULL NORMAL CHARACTERS
========================= */

async function pullRemoteEntes() {
  const remoteUserId = getRemoteUserId();
  if (!remoteUserId) return;

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

    const { data: remoteEntes } = await supabase
      .from("entes")
      .select("*")
      .eq("character_id", remoteChar.id);

    if (!remoteEntes) continue;

    const activeRemote = remoteEntes.filter(r => !r.is_deleted);
    const deletedRemote = remoteEntes.filter(r => r.is_deleted);

    for (const rd of deletedRemote) {
      const local = await db.entes
        .where("[characterId+enteID]")
        .equals([localChar.id!, rd.ente_id])
        .first();
      if (local && !local.isDirty) {
        await db.entes.delete(local.id!);
      }
    }

    const activeIds = new Set(activeRemote.map(r => r.ente_id));

    const localAll = await db.entes
      .where("characterId")
      .equals(localChar.id!)
      .toArray();
    const nonDeletedLocal = localAll.filter(e => !e.isDeleted);
    for (const le of nonDeletedLocal) {
      if (!activeIds.has(le.enteID) && !le.isDirty) {
        await db.entes.delete(le.id!);
      }
    }

    for (const remote of activeRemote) {
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
          order: Date.now(),
          notes: remote.notes ?? "",
          customImage: remote.custom_image ?? "",
          updatedAt: remoteTime,
          isDirty: false,
          isDeleted: false,
        });
      } else if (remoteTime > existing.updatedAt) {
        await db.entes.update(existing.id!, {
          amount: remote.amount,
          unlockLevel: remote.unlock_level,
          favorite: remote.favorite,
          notes: remote.notes ?? "",
          customImage: remote.custom_image ?? "",
          updatedAt: remoteTime,
          isDirty: false,
        });
      }
    }
  }
}

async function pullRemoteLoadouts() {
  const remoteUserId = getRemoteUserId();
  if (!remoteUserId) return;

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
        .where("remoteId")
        .equals(remote.id)
        .first();

      const remoteTime = new Date(remote.updated_at).getTime();

      const loadoutData = {
        hp: remote.hp,
        atk: remote.atk,
        weapon: remote.weapon,
        habilidadesPasivas: {
          max: 2,
          selectedIds: remote.habilidades_pasivas ?? [],
        },
        armorClass: remote.armor_class,
        slots: remote.slots,
        notes: remote.notes ?? "",
      };

      if (!existing) {
        await db.loadouts.add({
          characterId: localChar.id!,
          remoteId: remote.id,
          name: remote.name,
          data: loadoutData,
          updatedAt: remoteTime,
          isDeleted: false,
          isDirty: false,
        });
      } else if (remoteTime > existing.updatedAt) {
        await db.loadouts.update(existing.id!, {
          name: remote.name,
          data: loadoutData,
          updatedAt: remoteTime,
          isDirty: false,
        });
      }
    }
  }
}

async function pullRemoteInventories() {
  const remoteUserId = getRemoteUserId();
  if (!remoteUserId) return;

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

    const { data: remoteInv } = await supabase
      .from("inventory")
      .select("*")
      .eq("character_id", remoteChar.id)
      .single();

    if (!remoteInv) continue;

    const localInv = await db.inventory
      .where("characterId")
      .equals(localChar.id!)
      .first();

    const remoteTime = new Date(remoteInv.updated_at).getTime();

    if (!localInv) {
      await db.inventory.add({
        characterId: localChar.id!,
        remoteId: remoteInv.id,
        cards: remoteInv.cards ?? {},
        consumables: remoteInv.consumables ?? {},
        customItems: remoteInv.customItems ?? [],
        updatedAt: remoteTime,
        isDirty: false,
      });
    } else if (remoteTime > localInv.updatedAt) {
      await db.inventory.update(localInv.id!, {
        cards: remoteInv.cards ?? {},
        consumables: remoteInv.consumables ?? {},
        customItems: remoteInv.customItems ?? [],
        updatedAt: remoteTime,
        isDirty: false,
      });
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
    let local = await db.characters
      .where("remoteId")
      .equals(remote.id)
      .first();

    // Fallback: try to find by externalId (in case local record lost remoteId)
    if (!local && remote.external_id) {
      local = await db.characters
        .where("externalId")
        .equals(remote.external_id)
        .first();
    }

    const remoteTime = new Date(remote.updated_at).getTime();

    if (!local) {
      await db.characters.add({
        remoteId: remote.id,
        discordId: getDiscordId()!,
        externalId: remote.external_id ?? null,
        source: remote.external_id ? "external" : "web",
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

    // If found by externalId but missing remoteId, attach remoteId and update
    if (!local.remoteId) {
      await db.characters.update(local.id!, {
        remoteId: remote.id,
        updatedAt: Date.now(),
        isDirty: true,
      });
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

    if (remote.external_id && local.source !== "external") {
      await db.characters.update(local.id!, {
        source: "external",
        isDirty: true,
      });
    }
  }

  const remoteIds = new Set(remoteChars.map(c => c.id));
  const allLocal = await db.characters
    .where("discordId")
    .equals(getDiscordId()!)
    .toArray();

  for (const local of allLocal) {
    if (local.remoteId && !remoteIds.has(local.remoteId) && !local.isDirty) {
      await db.characters.delete(local.id!);
    }
  }

  await pullRemoteEntes();
  await pullRemoteLoadouts();
  await pullRemoteInventories();
}

/* =========================
   MASTER SYNC
========================= */

export async function syncAll() {
  await deduplicateCharacters();
  await pullCharactersExport();
  await pullRemoteCharacters();
  await pushLocalChanges();
}