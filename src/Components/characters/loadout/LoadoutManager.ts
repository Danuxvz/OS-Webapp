import { db } from "../database/db";
import type { Loadout } from "../../../types";
import type { DBLoadout } from "../database/db";

function dbToUI(row: DBLoadout): Loadout {
  return {
    id: String(row.id),
    characterId: row.characterId,
    name: row.name,
    data: row.data,
  };
}

function uiToDB(loadout: Loadout): DBLoadout {
  return {
    id: loadout.id ? Number(loadout.id) : undefined,
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

    // Mark the character dirty so pushLocalChanges picks up the new loadout
    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });

    return { ...loadout, id: String(id) };
  },

  async update(loadout: Loadout): Promise<void> {
    const existing = await db.loadouts.get(Number(loadout.id));
    if (!existing) return;

    await db.loadouts.put({
      ...existing,
      ...uiToDB(loadout),
    });

    // Mark the character dirty so changes sync to other browsers
    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });
  },

  async delete(loadoutId: string): Promise<void> {
    const loadout = await db.loadouts.get(Number(loadoutId));
    if (!loadout) return;

    await db.loadouts.delete(Number(loadoutId));

    await db.characters.update(loadout.characterId, {
      isDirty: true,
      updatedAt: Date.now(),
    });
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
  },
};