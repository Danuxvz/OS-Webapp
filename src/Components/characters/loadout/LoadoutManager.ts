import { db } from "../database/db";
import type { Loadout } from "../../../types";
import type { DBLoadout } from "../database/db";
import { syncCharacter } from "../../../services/Sync";

function dbToUI(row: DBLoadout): Loadout {
  return {
    id: String(row.id),
    remoteId: row.remoteId,
    characterId: row.characterId,
    name: row.name,
    data: row.data,
  };
}

function uiToDB(loadout: Loadout): DBLoadout {
  return {
    id: loadout.id ? Number(loadout.id) : undefined,
    remoteId: loadout.remoteId,
    characterId: loadout.characterId,
    name: loadout.name,
    data: loadout.data,
    updatedAt: Date.now(),
    isDirty: true,
    isDeleted: false,
  };
}

/**
 * Kick the per-character sync. We deliberately do NOT also call
 * triggerAutoSync(true) here — that used to fire a full-sync pass at
 * the same instant as the direct push, which caused two concurrent
 * Supabase requests that fought over the Navigator LockManager auth
 * lock. syncCharacter alone is enough for loadout edits; the
 * debounced/interval fallback in SyncScheduler picks up anything that
 * slips through.
 */
function kickCharacterSync(characterId: number) {
  void syncCharacter(characterId);
}

export const loadoutManager = {
  async getByCharacter(characterId: number): Promise<Loadout[]> {
    const rows = await db.loadouts
      .where("characterId")
      .equals(characterId)
      .filter((l) => !l.isDeleted)
      .toArray();

    return rows.map(dbToUI);
  },

  async create(loadout: Loadout): Promise<Loadout> {
    const id = await db.loadouts.add(uiToDB(loadout));

    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });

    kickCharacterSync(loadout.characterId);

    return { ...loadout, id: String(id) };
  },

  async update(loadout: Loadout): Promise<void> {
    const numericId = Number(loadout.id);
    if (!loadout.id || Number.isNaN(numericId)) {
      console.warn("loadoutManager.update: invalid loadout id", loadout.id);
      return;
    }

    const existing = await db.loadouts.get(numericId);
    if (!existing) {
      console.warn("loadoutManager.update: loadout row not found", numericId);
      return;
    }

    const toSave: DBLoadout = {
      ...existing,
      ...uiToDB(loadout),
      id: numericId,
      remoteId: loadout.remoteId ?? existing.remoteId,
    };

    await db.loadouts.put(toSave);

    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });

    kickCharacterSync(loadout.characterId);
  },

  async delete(loadoutId: string): Promise<void> {
    const loadout = await db.loadouts.get(Number(loadoutId));
    if (!loadout) return;

    await db.loadouts.delete(Number(loadoutId));

    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });

    kickCharacterSync(loadout.characterId);
  },

  async markLoadoutDeleted(loadoutId: string): Promise<void> {
    const id = Number(loadoutId);
    const loadout = await db.loadouts.get(id);
    if (!loadout) return;

    await db.loadouts.update(id, {
      isDeleted: true,
      isDirty: true,
      updatedAt: Date.now(),
    });

    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });

    kickCharacterSync(loadout.characterId);
  },
};