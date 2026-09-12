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
  tabId?: string;

  isPublished?: boolean;
  isImportedShared?: boolean;
}

export interface CustomItem {
  id: string;
  title: string;
  desc: string;
  count: number;
}

export interface Inventory extends SyncMeta {
  id?: number;
  characterId: number;
  remoteId?: string;
  cards: Record<string, number>;
  consumables: Record<string, number>;
  customItems: CustomItem[];
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
  isDeleted?: boolean;
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
   TABS
========================= */

export interface Tab {
  id?: string;
  remoteId?: string;
  name: string;
  order: number;
  isDeleted?: boolean;
}

/* =========================
   BOOKMARKS (browse-NPCs popup)
========================= */

export interface Bookmark {
  remoteCharacterId: string;
  createdAt: number;
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
  tabs!: Table<Tab, string>;
  bookmarks!: Table<Bookmark, string>;

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
        updatedAt,
        [characterId+name]
      `,
      enteMetadata: `
        id,
        updatedAt
      `
    }).upgrade(async (tx) => {
      const characters = await tx.table("characters").toArray();
      for (const char of characters) {
        if (!("remoteId" in char)) char.remoteId = undefined;
        if (!("externalId" in char)) char.externalId = null;
        if (!("source" in char)) char.source = "web";

        if (!char.bonusLog) char.bonusLog = { hp: {}, atk: {}, slots: {} };
        if (!char.tempStatBonus) char.tempStatBonus = { hp: 0, atk: 0, slots: 0 };
        if (!char.baseStats) char.baseStats = { hp: 10, atk: 0, slots: 15 };

        await tx.table("characters").put(char);
      }

      const inventory = await tx.table("inventory").toArray();
      for (const inv of inventory) {
        if (!("remoteId" in inv)) inv.remoteId = undefined;
        await tx.table("inventory").put(inv);
      }

      const entes = await tx.table("entes").toArray();
      for (const ente of entes) {
        if (!("remoteId" in ente)) ente.remoteId = undefined;
        await tx.table("entes").put(ente);
      }

      const loadouts = await tx.table("loadouts").toArray();
      for (const loadout of loadouts) {
        if (!("remoteId" in loadout)) loadout.remoteId = undefined;
        await tx.table("loadouts").put(loadout);
      }

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
          if (!Array.isArray(data.hp.sources)) { data.hp.sources = []; changed = true; }
          if (typeof data.hp.characterTempBonus !== "number") { data.hp.characterTempBonus = 0; changed = true; }
          if (typeof data.hp.tempBonus !== "number") { data.hp.tempBonus = 0; changed = true; }
          if (typeof data.hp.baseCurrent !== "number") { data.hp.baseCurrent = data.hp.baseMax ?? 0; changed = true; }
          if (!Array.isArray(data.hp.barriers)) { data.hp.barriers = []; changed = true; }
        }

        if (data?.atk) {
          if (!Array.isArray(data.atk.sources)) { data.atk.sources = []; changed = true; }
          if (typeof data.atk.characterTempBonus !== "number") { data.atk.characterTempBonus = 0; changed = true; }
          if (typeof data.atk.tempBonus !== "number") { data.atk.tempBonus = 0; changed = true; }
        }

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
            if (typeof data.slots.base !== "number") { data.slots.base = 0; changed = true; }
            if (typeof data.slots.tempBonus !== "number") { data.slots.tempBonus = 0; changed = true; }
            if (typeof data.slots.characterTempBonus !== "number") { data.slots.characterTempBonus = 0; changed = true; }
            if (!Array.isArray(data.slots.sources)) { data.slots.sources = []; changed = true; }
            if (!Array.isArray(data.slots.cards)) { data.slots.cards = []; changed = true; }
          }
        }

        if (data?.habilidadesPasivas) {
          if (Array.isArray(data.habilidadesPasivas)) {
            data.habilidadesPasivas = { max: 2, selectedIds: data.habilidadesPasivas };
            changed = true;
          } else {
            if (typeof data.habilidadesPasivas.max !== "number") { data.habilidadesPasivas.max = 2; changed = true; }
            if (!Array.isArray(data.habilidadesPasivas.selectedIds)) { data.habilidadesPasivas.selectedIds = []; changed = true; }
          }
        }

        if (l.isDeleted === undefined) { l.isDeleted = false; changed = true; }

        if (changed) {
          await tx.table("loadouts").put({ ...l, data });
        }
      }
    });

    this.version(9).stores({}).upgrade(async (tx) => {
      const entes = await tx.table("entes").toArray();
      for (const ente of entes) {
        if (ente.isDeleted === undefined) {
          ente.isDeleted = false;
          await tx.table("entes").put(ente);
        }
      }
    });

    this.version(10).stores({}).upgrade(async (tx) => {
      const inventories = await tx.table("inventory").toArray();
      for (const inv of inventories) {
        if (!Array.isArray(inv.customItems)) {
          inv.customItems = [];
          await tx.table("inventory").put(inv);
        }
      }
    });

    // Version 11 – tabs + character tab assignment
    this.version(11).stores({
      characters: `
        ++id,
        remoteId,
        externalId,
        source,
        discordId,
        charName,
        updatedAt,
        tabId
      `,
      tabs: `
        id,
        order
      `
    }).upgrade(async () => {});

    // Version 12 – add remoteId to tabs schema (required for queries)
    this.version(12).stores({
      tabs: `
        id,
        remoteId,
        order
      `
    }).upgrade(async (tx) => {
      const allTabs = await tx.table("tabs").toArray();
      for (const tab of allTabs) {
        if (!("remoteId" in tab)) {
          tab.remoteId = undefined;
          await tx.table("tabs").put(tab);
        }
      }
    });

    // Version 13 – add isDeleted to tabs
    this.version(13).stores({
      tabs: `
        id,
        remoteId,
        order,
        isDeleted
      `
    }).upgrade(async (tx) => {
      const allTabs = await tx.table("tabs").toArray();
      for (const tab of allTabs) {
        if (tab.isDeleted === undefined) {
          tab.isDeleted = false;
          await tx.table("tabs").put(tab);
        }
      }
    });

    // Version 14 – NPC sharing: publish flag, shared-import marker, bookmarks
    this.version(14).stores({
      characters: `
        ++id,
        remoteId,
        externalId,
        source,
        discordId,
        charName,
        updatedAt,
        tabId,
        isPublished,
        isImportedShared
      `,
      bookmarks: `
        remoteCharacterId
      `
    }).upgrade(async (tx) => {
      const characters = await tx.table("characters").toArray();
      for (const char of characters) {
        let changed = false;
        if (char.isPublished === undefined) { char.isPublished = false; changed = true; }
        if (char.isImportedShared === undefined) { char.isImportedShared = false; changed = true; }
        if (changed) await tx.table("characters").put(char);
      }
    });

    this.version(15).stores({}).upgrade(async (tx) => {
      const loadouts = await tx.table("loadouts").toArray();
      for (const l of loadouts) {
        const slots = l?.data?.slots;
        if (!slots) continue;

        const hasLegacyMax = typeof slots.max === "number";
        const needsBase = typeof slots.base !== "number";
        const needsSources = !Array.isArray(slots.sources);
        const needsCards = !Array.isArray(slots.cards);
        const needsTempBonus = typeof slots.tempBonus !== "number";
        const needsCharacterTemp = typeof slots.characterTempBonus !== "number";

        if (
          !hasLegacyMax && !needsBase && !needsSources &&
          !needsCards && !needsTempBonus && !needsCharacterTemp
        ) continue;

        l.data.slots = {
          base: hasLegacyMax ? slots.max : needsBase ? 0 : slots.base,
          tempBonus: needsTempBonus ? 0 : slots.tempBonus,
          characterTempBonus: needsCharacterTemp ? 0 : slots.characterTempBonus,
          sources: needsSources ? [] : slots.sources,
          cards: needsCards ? [] : slots.cards,
        };

        await tx.table("loadouts").put(l);
      }
    });

    // Version 16 – fold any pre-existing NPC slot bonuses into HP.
    //
    // NPCs don't use a Slots stat anymore; any SB that granted slots now adds
    // to HP instead. The bonus engine does this on every recalc for new data,
    // but existing characters whose `bonusLog` was computed before this change
    // still carry the old split. This pass merges them once so the UI is
    // consistent immediately, without waiting for the next ente edit.
    this.version(16).stores({}).upgrade(async (tx) => {
      const characters = await tx.table("characters").toArray();
      for (const char of characters) {
        const isNpc = !(Boolean(char.externalId) && !char.tabId);
        if (!isNpc) continue;

        const slots = char.bonusLog?.slots ?? {};
        if (Object.keys(slots).length === 0) continue;

        const hp: Record<string, number> = { ...(char.bonusLog?.hp ?? {}) };
        for (const [enteId, slotVal] of Object.entries(slots)) {
          const merged = (hp[enteId] ?? 0) + (Number(slotVal) || 0);
          if (merged !== 0) hp[enteId] = merged;
          else delete hp[enteId];
        }

        char.bonusLog = {
          hp,
          atk: char.bonusLog?.atk ?? {},
          slots: {},
        };

        await tx.table("characters").put(char);
      }
    });
  }
}

export const db = new OpenSourceDB();