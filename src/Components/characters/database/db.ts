import Dexie from "dexie";
import type { Table } from "dexie";

/* =========================
   BASE SYNC FIELDS
========================= */

interface SyncMeta {
  updatedAt: number;
  isDirty: boolean;
}

/* =========================
   TABLE INTERFACES
========================= */

export interface User extends SyncMeta {
  discordId: string;
  migratedFromBlob?: boolean;
  remoteId?: string; // optional if we want to track Supabase user ID later
}

export interface Character extends SyncMeta {
  id?: number;
  remoteId?: string;
	externalId?: string | null;
	source?: "web" | "external";
  discordId: string;
  charName: string;

  baseStats: {
    hp: number;
    atk: number;
    slots: number;
  };

  bonusLog: {
    hp: Record<string, number>;
    atk: Record<string, number>;
    slots: Record<string, number>;
  };

  tempStatBonus: {
    hp: number;
    atk: number;
    slots: number;
  };

  charImage: string;
  historySum: number;
  schemaVersion: number;
}

export interface Inventory extends SyncMeta {
  id?: number;
  characterId: number;
  remoteId?: string;
  cards: Record<string, number>;
  consumables: Record<string, number>;
}

export interface CharacterEnte extends SyncMeta {
  id?: number;
  characterId: number;
  remoteId?: string;
  enteID: string;
  amount: number;
  unlockLevel: number;
  favorite: boolean;
  order: number;
  notes?: string;
  customImage?: string;
}

export interface EnteMetadata extends SyncMeta {
  id: string;
  name: string;
  clase?: string;
  elemento?: string;
  image?: string;
  AE?: string;
  SB?: string;

  sbParsed?: {
    hp: number;
    atk: number;
    slots: number;
  };

  HE?: string;
  AC?: string;
  tier?: string;
  metadataVersion: number;
}

export interface Loadout extends SyncMeta {
  id?: number;
  characterId: number;
  remoteId?: string; // <-- new
  name: string;
  data: any;
}

/* =========================
   DATABASE CLASS
========================= */

class OpenSourceDB extends Dexie {
  users!: Table<User, string>;
  characters!: Table<Character, number>;
  inventory!: Table<Inventory, number>;
  entes!: Table<CharacterEnte, number>;
  loadouts!: Table<Loadout, number>;
  enteMetadata!: Table<EnteMetadata, string>;

  constructor() {
    super("OpenSourceDB");

    this.version(7).stores({
      users: "discordId",
      characters: `
        ++id,
        remoteId,
        externalId,
				source,
        discordId,
        charName,
        updatedAt
      `,
      inventory: `
        ++id,
        remoteId,
        characterId,
        updatedAt
      `,
      entes: `
        ++id,
        remoteId,
        characterId,
        enteID,
        updatedAt,
        [characterId+enteID]
      `,
      loadouts: `
        ++id,
        remoteId,
        characterId,
        updatedAt
      `,
      enteMetadata: `
        id,
        updatedAt
      `,
    }).upgrade(async (tx) => {
				/* =========================
					CHARACTERS
				========================= */

				const characters = await tx.table("characters").toArray();

				for (const char of characters) {

					if (!("remoteId" in char)) {
						char.remoteId = undefined;
					}

					if (!("externalId" in char)) {
						char.externalId = null;
					}

					if (!("source" in char)) {
						char.source = "web";
					}

					if (!char.bonusLog) {
						char.bonusLog = { hp: {}, atk: {}, slots: {} };
					}

					if (!char.tempStatBonus) {
						char.tempStatBonus = { hp: 0, atk: 0, slots: 0 };
					}

					if (!char.baseStats) {
						char.baseStats = { hp: 0, atk: 0, slots: 0 };
					}

					await tx.table("characters").put(char);
				}

				/* =========================
					INVENTORY
				========================= */

				const inventory = await tx.table("inventory").toArray();
				for (const inv of inventory) {
					if (!("remoteId" in inv)) inv.remoteId = undefined;
					await tx.table("inventory").put(inv);
				}

				/* =========================
					ENTES
				========================= */

				const entes = await tx.table("entes").toArray();
				for (const ente of entes) {
					if (!("remoteId" in ente)) ente.remoteId = undefined;
					await tx.table("entes").put(ente);
				}

				/* =========================
					LOADOUTS
				========================= */

				const loadouts = await tx.table("loadouts").toArray();
				for (const loadout of loadouts) {
					if (!("remoteId" in loadout)) loadout.remoteId = undefined;
					await tx.table("loadouts").put(loadout);
				}

				/* =========================
					USERS
				========================= */

				const users = await tx.table("users").toArray();
				for (const user of users) {
					if (!("remoteId" in user)) user.remoteId = undefined;
				await tx.table("users").put(user);
      }
    });
  }
}

export const db = new OpenSourceDB();