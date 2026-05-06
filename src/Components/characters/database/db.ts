import Dexie from "dexie";
import type { Table } from "dexie";
import type { LoadoutData } from "../../../types";

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
  remoteId?: string;
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
  isDeleted?: boolean;          // <-- new field
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

/* =========================
   LOADOUT (DB VERSION)
========================= */

export interface DBLoadout extends SyncMeta {
  id?: number;
  characterId: number;
  remoteId?: string;
  name: string;
  data: LoadoutData;
  isDeleted?: boolean;
}

/* =========================
   DATABASE CLASS
========================= */

class OpenSourceDB extends Dexie {
  users!: Table<User, string>;
  characters!: Table<Character, number>;
  inventory!: Table<Inventory, number>;
  entes!: Table<CharacterEnte, number>;
  loadouts!: Table<DBLoadout, number>;
  enteMetadata!: Table<EnteMetadata, string>;

  constructor() {
    super("OpenSourceDB");

    // Version 7 (existing)
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
        updatedAt,
        [characterId+name]
      `,
      enteMetadata: `
        id,
        updatedAt
      `
    }).upgrade(async (tx) => {

      /* =========================
         CHARACTERS
      ========================= */

      const characters = await tx.table("characters").toArray();
      for (const char of characters) {
        if (!("remoteId" in char)) char.remoteId = undefined;
        if (!("externalId" in char)) char.externalId = null;
        if (!("source" in char)) char.source = "web";

        if (!char.bonusLog) {
          char.bonusLog = { hp: {}, atk: {}, slots: {} };
        }

        if (!char.tempStatBonus) {
          char.tempStatBonus = { hp: 0, atk: 0, slots: 0 };
        }

        if (!char.baseStats) {
          char.baseStats = { hp: 10, atk: 0, slots: 15 };
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

    // Version 8 – patch loadout.data to include new fields and isDeleted
    this.version(8).stores({
      loadouts: `
        ++id,
        remoteId,
        characterId,
        updatedAt,
        [characterId+name]
      `
    }).upgrade(async (tx) => {
      const loadouts = await tx.table("loadouts").toArray();

      for (const l of loadouts) {
        const data = l.data;
        let changed = false;

        if (data?.hp) {
          if (!Array.isArray(data.hp.sources)) {
            data.hp.sources = [];
            changed = true;
          }
          if (typeof data.hp.characterTempBonus !== "number") {
            data.hp.characterTempBonus = 0;
            changed = true;
          }
          if (typeof data.hp.tempBonus !== "number") {
            data.hp.tempBonus = 0;
            changed = true;
          }
          if (typeof data.hp.baseCurrent !== "number") {
            data.hp.baseCurrent = data.hp.baseMax ?? 0;
            changed = true;
          }
          // Add barriers array if missing
          if (!Array.isArray(data.hp.barriers)) {
            data.hp.barriers = [];
            changed = true;
          }
        }

        if (data?.atk) {
          if (!Array.isArray(data.atk.sources)) {
            data.atk.sources = [];
            changed = true;
          }
          if (typeof data.atk.characterTempBonus !== "number") {
            data.atk.characterTempBonus = 0;
            changed = true;
          }
          if (typeof data.atk.tempBonus !== "number") {
            data.atk.tempBonus = 0;
            changed = true;
          }
        }

        // Migration for slots from old shape (max) to new shape
        if (data?.slots) {
          if (typeof data.slots.max === "number") {
            data.slots = {
              base: data.slots.max,
              tempBonus: 0,
              characterTempBonus: 0,
              sources: [],
              cards: data.slots.cards ?? [],
            };
            changed = true;
          } else {
            if (typeof data.slots.base !== "number") {
              data.slots.base = 0;
              changed = true;
            }
            if (typeof data.slots.tempBonus !== "number") {
              data.slots.tempBonus = 0;
              changed = true;
            }
            if (typeof data.slots.characterTempBonus !== "number") {
              data.slots.characterTempBonus = 0;
              changed = true;
            }
            if (!Array.isArray(data.slots.sources)) {
              data.slots.sources = [];
              changed = true;
            }
            if (!Array.isArray(data.slots.cards)) {
              data.slots.cards = [];
              changed = true;
            }
          }
        }

        // Migration for habilidadesPasivas from string[] to LoadoutHE
        if (data?.habilidadesPasivas) {
          if (Array.isArray(data.habilidadesPasivas)) {
            data.habilidadesPasivas = {
              max: 2,
              selectedIds: data.habilidadesPasivas,
            };
            changed = true;
          } else {
            if (typeof data.habilidadesPasivas.max !== "number") {
              data.habilidadesPasivas.max = 2;
              changed = true;
            }
            if (!Array.isArray(data.habilidadesPasivas.selectedIds)) {
              data.habilidadesPasivas.selectedIds = [];
              changed = true;
            }
          }
        }

        // Add isDeleted field if missing
        if (l.isDeleted === undefined) {
          l.isDeleted = false;
          changed = true;
        }

        if (changed) {
          await tx.table("loadouts").put({
            ...l,
            data
          });
        }
      }
    });

    // Version 9 – add isDeleted to entes (new)
    this.version(9).stores({
      // no schema changes, just data migration
    }).upgrade(async (tx) => {
      const entes = await tx.table("entes").toArray();
      for (const ente of entes) {
        if (ente.isDeleted === undefined) {
          ente.isDeleted = false;
          await tx.table("entes").put(ente);
        }
      }
    });
  }
}

export const db = new OpenSourceDB();