/* =====================================================
   ENTE (Character-owned instance)
===================================================== */

export interface Ente {
  id: string;
  name?: string;
  clase?: string;
  elemento?: string;
  image?: string;
  AE?: string;
  SB?: string;
  HE?: string;
  AC?: string;
  amount: number;
  unlockLevel: number;
  favorite?: boolean;
  order: number;
  notes?: string;
  customImage?: string;
}


/* =====================================================
   LOADOUT CORE PARTS
===================================================== */

export interface LoadoutStatSource {
  enteId: string;
  name: string;
  image?: string;
  bonus: number;
  enabled: boolean;
}

export type LoadoutHpSource = LoadoutStatSource;

export interface LoadoutBarrier {
  id: string;
  amount: number;
}

export interface LoadoutHP {
  baseMax: number;
  baseCurrent: number;
  tempBonus: number;
  characterTempBonus: number;
  sources: LoadoutHpSource[];
  barriers: LoadoutBarrier[];
}

export interface LoadoutATK {
  base: number;
  tempBonus: number;
  characterTempBonus: number;
  sources: LoadoutStatSource[];
}

export interface LoadoutWeapon {
  enteId: string | null;
  name: string;
  size: string;
  type: string;
  element: string;
  damageBonus: number;
  image?: string;
}

export interface LoadoutWeaponSource {
  enteId: string;
  name: string;
  image?: string;
  element?: string;
  amount: number;
}

export interface LoadoutHeSource {
  enteId: string;
  name: string;
  image?: string;
  text: string;
}

export interface LoadoutHE {
  max: number;
  selectedIds: string[];
}

export type ArmorType = "Lowgear" | "Headgear" | "Armor" | "Custom";

export interface LoadoutACSource {
  enteId: string;
  name: string;
  image?: string;
  text: string;
  type: ArmorType;
  bonus: number;
}

export interface LoadoutAC {
  enteId: string | null;
  type: ArmorType;
  name: string;
  bonus: number;
  text: string;
  image?: string;
}

export interface LoadoutSlotSource {
  enteId: string;
  name: string;
  image?: string;
  bonus: number;
  enabled: boolean;
}

export interface LoadoutSlotCard {
  cardId: string;
  quantity: number;
  usedIndices: number[];
}

export interface LoadoutSlots {
  base: number;
  tempBonus: number;
  characterTempBonus: number;
  sources: LoadoutSlotSource[];
  cards: LoadoutSlotCard[];
}


/* =====================================================
   LOADOUT DATA (STORED IN DB)
===================================================== */

export interface LoadoutData {
  hp: LoadoutHP;
  atk: LoadoutATK;
  weapon: LoadoutWeapon;
  habilidadesPasivas: LoadoutHE;
  armorClass: LoadoutAC;
  slots: LoadoutSlots;
  notes: string;
}


/* =====================================================
   FULL LOADOUT (UI VERSION)
===================================================== */

export interface Loadout {
  id: string;
  remoteId?: string;
  characterId: number;
  name: string;
  data: LoadoutData;
}