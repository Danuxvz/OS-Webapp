import { db } from "../database/db";
import type { Loadout } from "../../../types";
import type { DBLoadout } from "../database/db";
import { triggerAutoSync } from "../../../services/SyncScheduler.ts";

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

    triggerAutoSync(true);

    return { ...loadout, id: String(id) };
  },

  async update(loadout: Loadout): Promise<void> {
    const existing = await db.loadouts.get(Number(loadout.id));
    if (!existing) return;

    const toSave: DBLoadout = {
      ...existing,
      ...uiToDB(loadout),
      remoteId: loadout.remoteId ?? existing.remoteId,
    };

    await db.loadouts.put(toSave);

    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });

    triggerAutoSync(true);
  },

  async delete(loadoutId: string): Promise<void> {
    const loadout = await db.loadouts.get(Number(loadoutId));
    if (!loadout) return;

    await db.loadouts.delete(Number(loadoutId));

    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });

    triggerAutoSync(true);
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

    triggerAutoSync(true);
  },
};