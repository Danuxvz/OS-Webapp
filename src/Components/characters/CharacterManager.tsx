// CharacterManager.ts
import { db } from "./database/db";
import type { Character, CharacterEnte, Tab, Bookmark } from "./database/db";
import { StatBonusEngine } from "./entes/StatBonus";
import "./entes/SpecialEntes";
import { getEnteMetadata } from "../../services/enteMetadataService";
import { triggerAutoSync } from "../../services/SyncScheduler";

function createSyncMeta() {
  return {
    updatedAt: Date.now(),
    isDirty: true,
  };
}

export function computeUnlockLevel(amount: number) {
  if (amount >= 5) return 4;
  if (amount === 4) return 3;
  if (amount === 3) return 2;
  if (amount === 2) return 1;
  return 0;
}

/**
 * A real ente ID looks like E001, E005A, D020, C009T, E123J. Faction tokens
 * ("Hexen"), medals ("Ghoul_Medal"), and malformed entries ("E005:AE") all
 * fail this check, so we can silently skip them wherever the ente pipeline
 * would otherwise treat them as entes.
 */
export function isEnteId(id: string): boolean {
  return /^[A-Z]\d{3}[A-Z]*$/i.test(id ?? "");
}

/**
 * E-series variant groups. All variants of a given base share the *highest*
 * unlock level in their group (E005 Tsuchigumo, E052 Mandrágoras, E060
 * Kobolds). This MUST match the grouping used in EntesSection (UI).
 */
export const SPECIAL_E_VARIANT_PREFIXES = ["E005", "E052", "E060"] as const;

export function getSpecialEVariantGroup(enteID: string): string | null {
  if (!enteID) return null;
  const upper = enteID.toUpperCase();
  for (const prefix of SPECIAL_E_VARIANT_PREFIXES) {
    if (upper.startsWith(prefix)) return prefix;
  }
  return null;
}

/**
 * Shared NPC classifier. A character is a "main" only if it came from a
 * Discord export AND is not assigned to a custom tab. Everything else
 * (custom tabs, NPC tab, shared imports) is treated as an NPC.
 */
export function isNpcCharacter(
  char: Pick<Character, "externalId" | "tabId">
): boolean {
  return !(Boolean(char.externalId) && !char.tabId);
}

type Listener = (payload: any) => void;

export type DarumaSwapResult = {
  characterId: number;
  sourceEnteID: string;
  targetEnteID: string;
  sourceAmount: number;
  targetAmount: number;
};

class CharacterManager {
  private listeners: Map<string, Set<Listener>> = new Map();

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
      bonusLog: { hp: {}, atk: {}, slots: {} },
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
      customItems: [],
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
            isDirty: true,
          });

        if (modifiedCount === 0) {
          throw new Error(`Ente ${u.id} not found for character ${characterId}`);
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

  async updateCharacter(characterId: number, updates: Partial<Character>) {
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
      const newAmount = existing.isDeleted ? amount : existing.amount + amount;
      await db.entes.update(existing.id!, {
        amount: newAmount,
        unlockLevel: computeUnlockLevel(newAmount),
        isDeleted: false,
        updatedAt: Date.now(),
        isDirty: true,
      });
    } else {
      await db.entes.add({
        characterId,
        enteID,
        amount,
        unlockLevel: computeUnlockLevel(amount),
        favorite: false,
        order: Date.now(),
        isDeleted: false,
        ...createSyncMeta(),
      });
    }

    triggerAutoSync();

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
        unlockLevel: 0,
        isDeleted: true,
        isDirty: true,
        updatedAt: Date.now(),
      });
    } else {
      await db.entes.update(existing.id!, {
        amount: newAmount,
        unlockLevel: computeUnlockLevel(newAmount),
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
      .filter((e) => !e.isDeleted)
      .sortBy("order");
  }

  async updateEnte(
    characterId: number,
    enteID: string,
    updates: Partial<CharacterEnte>
  ) {
    if (updates.amount !== undefined) {
      updates.unlockLevel = computeUnlockLevel(updates.amount);
    }

    await db.entes
      .where("[characterId+enteID]")
      .equals([characterId, enteID])
      .modify({
        ...updates,
        updatedAt: Date.now(),
        isDirty: true,
      });
    triggerAutoSync();

    if (updates.unlockLevel !== undefined || updates.amount !== undefined) {
      await this.recalculateCharacterBonuses(characterId);
    }

    const entes = await this.getEntes(characterId);
    this.emit("entesUpdated", { characterId, entes });
  }

  async emitEntesUpdated(characterId: number) {
    const entes = await this.getEntes(characterId);
    this.emit("entesUpdated", { characterId, entes });
  }

  /* =========================
     DARUMA RANDOMIZATION
  ========================= */

  private isDaruma(id: string) {
    return /^E123[A-J]$/i.test(id);
  }

  private pickRandomDaruma(exclude: string) {
    const pool = [
      "E123A", "E123B", "E123C", "E123D", "E123E",
      "E123F", "E123G", "E123H", "E123I", "E123J",
    ].filter((id) => id !== exclude.toUpperCase());
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async randomizeDaruma(
    characterId: number,
    sourceEnteID: string,
    forcedTargetEnteID?: string
  ): Promise<DarumaSwapResult> {
    if (!this.isDaruma(sourceEnteID)) {
      throw new Error("That ente is not a Daruma.");
    }

    const source = await db.entes
      .where("[characterId+enteID]")
      .equals([characterId, sourceEnteID])
      .first();

    if (!source || source.isDeleted) {
      throw new Error("Daruma not found.");
    }

    const targetEnteID =
      forcedTargetEnteID && forcedTargetEnteID !== sourceEnteID
        ? forcedTargetEnteID
        : this.pickRandomDaruma(sourceEnteID);

    const targetRaw = await db.entes
      .where("[characterId+enteID]")
      .equals([characterId, targetEnteID])
      .first();
    const target = targetRaw && !targetRaw.isDeleted ? targetRaw : null;

    const now = Date.now();
    const sourceAmount = source.amount ?? 0;
    const targetAmount = target?.amount ?? 0;

    await db.transaction("rw", db.entes, async () => {
      if (target) {
        const tempId = `__daruma_swap__${now}_${Math.random().toString(36).slice(2, 8)}`;

        await db.entes.update(target.id!, {
          enteID: tempId,
          updatedAt: now,
          isDirty: true,
        });

        await db.entes.update(source.id!, {
          enteID: targetEnteID,
          amount: targetAmount,
          unlockLevel: computeUnlockLevel(targetAmount),
          updatedAt: now,
          isDirty: true,
        });

        await db.entes.update(target.id!, {
          enteID: sourceEnteID,
          amount: sourceAmount,
          unlockLevel: computeUnlockLevel(sourceAmount),
          updatedAt: now,
          isDirty: true,
        });
      } else {
        await db.entes.update(source.id!, {
          enteID: targetEnteID,
          amount: sourceAmount,
          unlockLevel: computeUnlockLevel(sourceAmount),
          updatedAt: now,
          isDirty: true,
        });
      }
    });

    await this.recalculateCharacterBonuses(characterId);

    const entes = await this.getEntes(characterId);
    this.emit("entesUpdated", { characterId, entes });

    return {
      characterId,
      sourceEnteID,
      targetEnteID,
      sourceAmount,
      targetAmount,
    };
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
      .filter((e) => !e.isDeleted)
      .toArray();

    // FIX: share the unlock level across E-variant siblings (E005/E052/E060),
    // exactly the way EntesSection (UI) does.
    const groupMaxAmount = new Map<string, number>();
    for (const ente of entes) {
      if (!isEnteId(ente.enteID)) continue;
      const group = getSpecialEVariantGroup(ente.enteID);
      if (!group) continue;
      const amt = ente.amount ?? 0;
      if (amt > (groupMaxAmount.get(group) ?? 0)) {
        groupMaxAmount.set(group, amt);
      }
    }

    const engine = new StatBonusEngine(character.baseStats);
    engine.tempBonus = character.tempStatBonus;

    for (const ente of entes) {
      // Skip non-ente rows (faction tokens, medals, malformed IDs) — they
      // have no SB to apply and would only spam the console with warnings.
      if (!isEnteId(ente.enteID)) continue;

      const group = getSpecialEVariantGroup(ente.enteID);
      const effectiveAmount = group
        ? groupMaxAmount.get(group) ?? 0
        : ente.amount ?? 0;

      const effectiveUnlock = computeUnlockLevel(effectiveAmount);
      if (effectiveUnlock < 2) continue;

      const metadata = await getEnteMetadata(ente.enteID);
      if (!metadata) {
        console.warn(
          `[recalculateCharacterBonuses] Missing metadata for ente ${ente.enteID} (character ${characterId}); skipped.`
        );
        continue;
      }

      engine.applyEnte(ente.enteID, metadata.SB ?? "", effectiveUnlock, {
        character,
        entes,
      });
    }

    // NPCs have no Slots stat — any SB that would grant slots is folded into
    // HP instead, entry by entry, so the loadout's HP total lines up with the
    // character sheet's HP total. Main characters are unaffected.
    if (isNpcCharacter(character)) {
      const slotsLog = { ...engine.bonusLog.slots };
      engine.bonusLog.slots = {};
      for (const [enteId, slotVal] of Object.entries(slotsLog)) {
        const merged = (engine.bonusLog.hp[enteId] ?? 0) + (Number(slotVal) || 0);
        if (merged !== 0) {
          engine.bonusLog.hp[enteId] = merged;
        } else {
          delete engine.bonusLog.hp[enteId];
        }
      }
    }

    await db.characters.update(characterId, {
      bonusLog: engine.bonusLog,
      updatedAt: Date.now(),
      isDirty: true,
    });

    triggerAutoSync();

    const fresh = await this.getCharacter(characterId);
    if (fresh) this.emit("characterUpdated", fresh);

    this.emit("bonusUpdated", { characterId, bonusLog: engine.bonusLog });
    return engine.bonusLog;
  }

  /* =========================
     LOADOUTS
  ========================= */

  async saveLoadout(characterId: number, name: string, data: any) {
    const id = await db.loadouts.add({
      characterId,
      name,
      data,
      ...createSyncMeta(),
    });
    triggerAutoSync();
    return id;
  }

  async getLoadouts(characterId: number) {
    return db.loadouts.where({ characterId }).toArray();
  }

  /* =========================
     TABS
  ========================= */

  async getTabs(): Promise<Tab[]> {
    return db.tabs.orderBy("order").toArray();
  }

  async createTab(name: string): Promise<string> {
    const id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const count = await db.tabs.count();
    await db.tabs.add({ id, name, order: count });
    triggerAutoSync();
    return id;
  }

  async deleteTab(tabId: string): Promise<void> {
    const chars = await db.characters.where("tabId").equals(tabId).toArray();
    for (const c of chars) {
      await db.characters.update(c.id!, {
        tabId: undefined,
        updatedAt: Date.now(),
        isDirty: true,
      });
    }
    await db.tabs.delete(tabId);
    triggerAutoSync();
  }

  async updateCharacterTab(characterId: number, tabId: string | null): Promise<void> {
    await db.characters.update(characterId, {
      tabId: tabId ?? undefined,
      isImportedShared: false,
      updatedAt: Date.now(),
      isDirty: true,
    });
    triggerAutoSync();
  }

  /* =========================
     SHARING / PUBLISHING
  ========================= */

  async setPublished(characterId: number, published: boolean) {
    await db.characters.update(characterId, {
      isPublished: published,
      updatedAt: Date.now(),
      isDirty: true,
    });
    triggerAutoSync();

    const fresh = await this.getCharacter(characterId);
    if (fresh) this.emit("characterUpdated", fresh);
    return fresh;
  }

  async importSharedCharacter(
    discordId: string,
    remote: {
      charName: string;
      baseStats: Character["baseStats"];
      bonusLog: Character["bonusLog"];
      tempStatBonus: Character["tempStatBonus"];
      charImage: string;
      historySum: number;
      schemaVersion: number;
      entes: {
        enteID: string;
        amount: number;
        unlockLevel: number;
        notes?: string;
        customImage?: string;
        order: number;
      }[];
      loadouts: { name: string; data: any }[];
    }
  ): Promise<number> {
    const characterId = await db.characters.add({
      discordId,
      charName: remote.charName,
      baseStats: remote.baseStats,
      bonusLog: remote.bonusLog,
      tempStatBonus: remote.tempStatBonus,
      charImage: remote.charImage,
      historySum: remote.historySum,
      schemaVersion: remote.schemaVersion,
      source: "web",
      isPublished: false,
      isImportedShared: true,
      ...createSyncMeta(),
    });

    await db.inventory.add({
      characterId,
      cards: {},
      consumables: {},
      customItems: [],
      ...createSyncMeta(),
    });

    for (const ente of remote.entes) {
      if (!isEnteId(ente.enteID)) continue;
      await db.entes.add({
        characterId,
        enteID: ente.enteID,
        amount: ente.amount,
        unlockLevel: ente.unlockLevel,
        favorite: false,
        order: ente.order,
        notes: ente.notes,
        customImage: ente.customImage,
        isDeleted: false,
        ...createSyncMeta(),
      });
    }

    for (const loadout of remote.loadouts) {
      await db.loadouts.add({
        characterId,
        name: loadout.name,
        data: loadout.data,
        isDeleted: false,
        ...createSyncMeta(),
      });
    }

    await this.recalculateCharacterBonuses(characterId);
    triggerAutoSync();

    const fresh = await this.getCharacter(characterId);
    this.emit("characterCreated", fresh);
    return characterId;
  }

  /* =========================
     BOOKMARKS
  ========================= */

  async getBookmarks(): Promise<Bookmark[]> {
    return db.bookmarks.toArray();
  }

  async isBookmarked(remoteCharacterId: string): Promise<boolean> {
    const row = await db.bookmarks.get(remoteCharacterId);
    return !!row;
  }

  async addBookmark(remoteCharacterId: string): Promise<void> {
    await db.bookmarks.put({ remoteCharacterId, createdAt: Date.now() });
  }

  async removeBookmark(remoteCharacterId: string): Promise<void> {
    await db.bookmarks.delete(remoteCharacterId);
  }
}

export const characterManager = new CharacterManager();