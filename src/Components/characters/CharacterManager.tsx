// CharacterManager.ts
import { db } from "./database/db";
import type { Character, CharacterEnte } from "./database/db";
import { StatBonusEngine } from "./entes/StatBonus";
import { getEnteMetadata } from "../../services/enteMetadataService";
import { triggerAutoSync } from "../../services/SyncScheduler"; 

function createSyncMeta() {
	return {
		updatedAt: Date.now(),
		isDirty: true,
	};
}

type Listener = (payload: any) => void;

class CharacterManager {
	private listeners: Map<string, Set<Listener>> = new Map();

	/* =========================
		 Event emitter helpers
	========================= */
	on(event: string, cb: Listener) {
		if (!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event)!.add(cb);
	}

	off(event: string, cb: Listener) {
		this.listeners.get(event)?.delete(cb);
	}

	private emit(event: string, payload?: any) {
		const set = this.listeners.get(event);
		if (!set) return;
		for (const cb of Array.from(set)) {
			try {
				cb(payload);
			} catch (err) {
				console.error("CharacterManager listener error:", err);
			}
		}
	}

	/* =========================
		 CHARACTER
	========================= */

	async createCharacter(discordId: string, charName: string) {
		const characterId = await db.characters.add({
			discordId,
			charName,
			baseStats: { hp: 10, atk: 0, slots: 15 },

			bonusLog: {
				hp: {},
				atk: {},
				slots: {},
			},

			tempStatBonus: { hp: 0, atk: 0, slots: 0 },
			charImage: "",
			historySum: 0,
			schemaVersion: 2,
			...createSyncMeta(),
		});

		await db.inventory.add({
			characterId,
			cards: {},
			consumables: {},
			...createSyncMeta(),
		});

		const fresh = await this.getCharacter(characterId);
		this.emit("characterCreated", fresh);
		return characterId;
	}

	async deleteCharacter(characterId: number) {
		await db.characters.delete(characterId);
		await db.inventory.where({ characterId }).delete();
		await db.entes.where({ characterId }).delete();
		await db.loadouts.where({ characterId }).delete();

		triggerAutoSync();

		this.emit("characterDeleted", characterId);
	}

async updateEntesOrder(
  characterId: number,
  updates: { id: string; order: number }[]
) {
  await db.transaction("rw", db.entes, async () => {
    for (const u of updates) {
      const modifiedCount = await db.entes
        .where({ characterId, enteID: u.id })
        .modify({
          order: u.order,
          updatedAt: Date.now(),
          isDirty: true
        });

      if (modifiedCount === 0) {
        throw new Error(
          `Ente ${u.id} not found for character ${characterId}`
        );
      }
    }
  });

  triggerAutoSync();

  const entes = await this.getEntes(characterId);
  this.emit("entesUpdated", { characterId, entes });
}

	async getCharacter(characterId: number) {
		return db.characters.get(characterId);
	}

	async getCharactersByUser(discordId: string) {
		return db.characters.where({ discordId }).toArray();
	}

	async updateCharacter(
		characterId: number,
		updates: Partial<Character>
	) {
		await db.characters.update(characterId, {
			...updates,
			updatedAt: Date.now(),
			isDirty: true,
		});
		triggerAutoSync();

		const fresh = await this.getCharacter(characterId);
		if (fresh) this.emit("characterUpdated", fresh);
		return fresh;
	}

	/* =========================
		 INVENTORY
	========================= */

	async getInventory(characterId: number) {
		return db.inventory.where({ characterId }).first();
	}

	async updateInventory(
		characterId: number,
		section: "cards" | "consumables",
		itemId: string,
		delta: number
	) {
		const inventory = await this.getInventory(characterId);
		if (!inventory) return;

		await db.inventory.update(inventory.id!, (inv) => {
			const current = inv[section][itemId] ?? 0;
			inv[section][itemId] = Math.max(0, current + delta);
			inv.updatedAt = Date.now();
			inv.isDirty = true;
		});

		const freshInv = await this.getInventory(characterId);
		this.emit("inventoryUpdated", { characterId, inventory: freshInv });
	}

	/* =========================
		 ENTES
	========================= */

	async addEnte(characterId: number, enteID: string, amount = 1) {
		const existing = await db.entes
			.where("[characterId+enteID]")
			.equals([characterId, enteID])
			.first();

		if (existing) {
			await db.entes.update(existing.id!, {
				amount: existing.amount + amount,
				updatedAt: Date.now(),
				isDirty: true,
			});
			triggerAutoSync();
		} else {
			await db.entes.add({
				characterId,
				enteID,
				amount,
				unlockLevel: 1,
				favorite: false,
				order: Date.now(),
				...createSyncMeta(),
			});
		}

		await this.recalculateCharacterBonuses(characterId);
		const entes = await this.getEntes(characterId);
		this.emit("entesUpdated", { characterId, entes });
	}

	async removeEnte(characterId: number, enteID: string, amount = 1) {
	const existing = await db.entes
		.where("[characterId+enteID]")
		.equals([characterId, enteID])
		.first();

	if (!existing || existing.isDeleted) return;

	const newAmount = Math.max(0, existing.amount - amount);

	if (newAmount === 0) {
		await db.entes.update(existing.id!, {
		amount: 0,
		isDeleted: true,
		isDirty: true,
		updatedAt: Date.now(),
		});
	} else {
		await db.entes.update(existing.id!, {
		amount: newAmount,
		isDirty: true,
		updatedAt: Date.now(),
		});
	}
	triggerAutoSync();

	await this.recalculateCharacterBonuses(characterId);
	const entes = await this.getEntes(characterId);
	this.emit("entesUpdated", { characterId, entes });
	}

	async getEntes(characterId: number) {
	if (characterId == null) return [];
	return db.entes
		.where("characterId")
		.equals(characterId)
		.filter(e => !e.isDeleted)
		.sortBy("order");
	}

	async updateEnte(
		characterId: number,
		enteID: string,
		updates: Partial<CharacterEnte>
	) {
		await db.entes
			.where("[characterId+enteID]")
			.equals([characterId, enteID])
			.modify({
				...updates,
				updatedAt: Date.now(),
				isDirty: true,
			});
			triggerAutoSync();

		if (
			updates.unlockLevel !== undefined ||
			updates.amount !== undefined
		) {
			await this.recalculateCharacterBonuses(characterId);
		}

		const entes = await this.getEntes(characterId);
		this.emit("entesUpdated", { characterId, entes });
	}

	/* =========================
		 BONUS RECALCULATION
	========================= */

	async recalculateCharacterBonuses(characterId: number) {
		const character = await db.characters.get(characterId);
		if (!character) return;

		const entes = await db.entes
			.where("characterId")
			.equals(characterId)
			.toArray();

		const engine = new StatBonusEngine(character.baseStats);

		engine.tempBonus = character.tempStatBonus;

		for (const ente of entes) {
			if (ente.unlockLevel < 2) continue;

			const metadata = await getEnteMetadata(ente.enteID);
			if (!metadata) continue;

			engine.applyEnte(
				ente.enteID,
				metadata.SB ?? "",
				ente.unlockLevel,
				character
			);
		}

		await db.characters.update(characterId, {
			bonusLog: engine.bonusLog,
			updatedAt: Date.now(),
			isDirty: true,
		});
		
		triggerAutoSync();

		// fetch the fresh character object and emit it
		const fresh = await this.getCharacter(characterId);

		if (fresh) this.emit("characterUpdated", fresh);

			this.emit("bonusUpdated", { characterId, bonusLog: engine.bonusLog });

		return engine.bonusLog;
	}

	/* =========================
		 LOADOUTS
	========================= */

	async saveLoadout(characterId: number, name: string, data: any) {
		return db.loadouts.add({
			characterId,
			name,
			data,
			...createSyncMeta(),
		});
		triggerAutoSync();
	}

	async getLoadouts(characterId: number) {
		return db.loadouts.where({ characterId }).toArray();
	}
}

export const characterManager = new CharacterManager();