import { supabase } from "./SupaBase";

/* =========================
   CONFIG
========================= */

const FACTION_BOON_SHEET_ID = "1LWhg-GA_QuFOlic2-oD7lFX2whhq-i5QPljdwCB0fCk";
const FACTION_BOON_SHEET_NAME = "factions_rows";
const BOON_CACHE_KEY = "faction_boon_cache_v1";
const COLOR_CACHE_KEY = "faction_color_cache_v1";

/**
 * XP thresholds, mirrored from faction_progression.py. Rank order A..E maps
 * to these in order. Kept as a constant since it's bot-side gameplay logic,
 * not sheet data.
 */
export const FACTION_THRESHOLDS = [5, 10, 20, 30, 45] as const;

/**
 * Faction IDs we always recognize even if the sheet fails to load. The
 * sheet is the source of truth for boon metadata; this list is only a
 * safety net so a Discord sync still routes these tokens into
 * `inventory.consumables` if the sheet is unreachable.
 */
const FALLBACK_FACTION_IDS = ["Hexen", "Yuugen", "Carnival"] as const;

/* =========================
   TYPES
========================= */

export interface FactionBoonMeta {
  /** Canonical case as it appears in the sheet: "Hexen", "Yuugen", ... */
  factionId: string;
  /** "A", "B", ... — the part after the colon in the sheet id */
  rankKey: string;
  /** "Notario", "Estenógrafo", ... — from the sheet `type` column */
  rankName: string;
  /** "Servant of the Witches" — from the sheet `title` column */
  title: string;
  /** From the sheet `description` column */
  description: string;
}

export interface UnlockedBoon extends FactionBoonMeta {
  /** Token count in the character's inventory for this faction */
  tokens: number;
  /** Hex color from the Supabase `factions` table, or null if unknown. */
  color: string | null;
}

/* =========================
   INTERNAL CACHES
========================= */

interface FactionSheet {
  /** Key = "HEXEN:A" (upper-cased). */
  boonIndex: Record<string, FactionBoonMeta>;
  /** Ordered rank keys: ["A", "B", "C", "D", "E"]. */
  rankOrder: string[];
  /** rankKey → rank name (e.g. "A" → "Notario"). */
  rankNamesByKey: Record<string, string>;
  /** Unique faction IDs in encounter order from the sheet. */
  factionIds: string[];
}

let sheetCache: FactionSheet | null = null;
let sheetBuildPromise: Promise<FactionSheet> | null = null;

/** Key = faction name lowercased. Value = "#RRGGBB". */
let colorCache: Record<string, string> | null = null;
let colorBuildPromise: Promise<Record<string, string>> | null = null;

/* =========================
   FETCH + PARSE — SHEET
========================= */

async function fetchGviz(spreadsheetId: string, sheetName: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(jsonText).table;
}

/** Sheet column order: id, title, type, description, released. */
const COL_ID = 0;
const COL_TITLE = 1;
const COL_TYPE = 2;
const COL_DESCRIPTION = 3;
// const COL_RELEASED = 4; // unused for now

function splitBoonKey(raw: string): { factionId: string; rankKey: string } | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(":");
  if (idx <= 0) return null;
  const factionId = trimmed.slice(0, idx).trim();
  const rankKey = trimmed.slice(idx + 1).trim().toUpperCase();
  if (!factionId || !rankKey) return null;
  return { factionId, rankKey };
}

async function buildFactionSheet(): Promise<FactionSheet> {
  if (sheetBuildPromise) return sheetBuildPromise;

  sheetBuildPromise = (async () => {
    // 1) Try localStorage cache first.
    const cached = localStorage.getItem(BOON_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as FactionSheet;
        if (
          parsed &&
          parsed.boonIndex &&
          Array.isArray(parsed.rankOrder) &&
          Array.isArray(parsed.factionIds)
        ) {
          sheetCache = parsed;
          return parsed;
        }
      } catch {
        localStorage.removeItem(BOON_CACHE_KEY);
      }
    }

    // 2) Fetch + parse.
    const table = await fetchGviz(FACTION_BOON_SHEET_ID, FACTION_BOON_SHEET_NAME);

    const boonIndex: Record<string, FactionBoonMeta> = {};
    const rankKeysSeen = new Set<string>();
    const rankNamesByKey: Record<string, string> = {};
    const factionIdsSeen: string[] = [];
    const factionIdsSeenSet = new Set<string>();

    for (const row of table.rows ?? []) {
      const rawId = String(row.c[COL_ID]?.v ?? "").trim();
      const parts = splitBoonKey(rawId);
      if (!parts) continue;

      const { factionId, rankKey } = parts;
      const title = String(row.c[COL_TITLE]?.v ?? "").trim();
      const rankName = String(row.c[COL_TYPE]?.v ?? "").trim();
      const description = String(row.c[COL_DESCRIPTION]?.v ?? "").trim();

      const key = `${factionId.toUpperCase()}:${rankKey}`;
      boonIndex[key] = {
        factionId,
        rankKey,
        rankName,
        title,
        description,
      };

      rankKeysSeen.add(rankKey);
      if (rankName && !rankNamesByKey[rankKey]) {
        rankNamesByKey[rankKey] = rankName;
      }

      if (!factionIdsSeenSet.has(factionId)) {
        factionIdsSeenSet.add(factionId);
        factionIdsSeen.push(factionId);
      }
    }

    const rankOrder = Array.from(rankKeysSeen).sort();

    const sheet: FactionSheet = {
      boonIndex,
      rankOrder,
      rankNamesByKey,
      factionIds: factionIdsSeen,
    };

    sheetCache = sheet;
    try {
      localStorage.setItem(BOON_CACHE_KEY, JSON.stringify(sheet));
    } catch {
      // ignore quota errors
    }
    return sheet;
  })().finally(() => {
    sheetBuildPromise = null;
  });

  return sheetBuildPromise;
}

/* =========================
   FETCH + PARSE — COLORS
========================= */

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

async function buildColorMap(): Promise<Record<string, string>> {
  if (colorBuildPromise) return colorBuildPromise;

  colorBuildPromise = (async () => {
    // 1) Try localStorage cache first.
    const cached = localStorage.getItem(COLOR_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          colorCache = parsed;
          return parsed as Record<string, string>;
        }
      } catch {
        localStorage.removeItem(COLOR_CACHE_KEY);
      }
    }

    // 2) Fetch from Supabase. We don't have a guild context in the web app,
    // so we pull every faction row and resolve conflicts by name (latest
    // updated_at wins). This works for the common case where only one game
    // server has "real" factions defined.
    const { data, error } = await supabase
      .from("factions")
      .select("name,color,updated_at");

    if (error) {
      console.warn("[FactionService] Failed to fetch faction colors:", error);
      return {};
    }

    const map: Record<string, string> = {};
    const updatedAtByName: Record<string, string> = {};

    for (const row of data ?? []) {
      const key = String(row.name ?? "").trim().toLowerCase();
      if (!key) continue;

      const color = String(row.color ?? "").trim();
      if (!HEX_COLOR_RE.test(color)) continue;

      const ts = String(row.updated_at ?? "");
      const prevTs = updatedAtByName[key];
      // If we've never seen this name, or this row is newer, take it.
      if (!map[key] || (ts && (!prevTs || ts > prevTs))) {
        map[key] = color;
        updatedAtByName[key] = ts;
      }
    }

    colorCache = map;
    try {
      localStorage.setItem(COLOR_CACHE_KEY, JSON.stringify(map));
    } catch {
      // ignore quota errors
    }
    return map;
  })().finally(() => {
    colorBuildPromise = null;
  });

  return colorBuildPromise;
}

/* =========================
   PUBLIC API
========================= */

/**
 * Kick both sheet + color fetches off at app startup so the InventorySection
 * can render boons with their faction colors on first open without a wait.
 */
export async function preloadFactions(): Promise<void> {
  await Promise.all([
    preloadFactionSheet(),
    preloadFactionColors(),
  ]);
}

/**
 * Sheet-only preload (kept separate so callers that don't need colors can
 * avoid the extra round-trip).
 */
export async function preloadFactionSheet(): Promise<void> {
  if (sheetCache) return;
  try {
    await buildFactionSheet();
  } catch (err) {
    console.warn("[FactionService] Failed to preload faction sheet:", err);
  }
}

/**
 * Color-only preload. Fetches the Supabase `factions` table and caches a
 * name → hex map.
 */
export async function preloadFactionColors(): Promise<void> {
  if (colorCache) return;
  try {
    await buildColorMap();
  } catch (err) {
    console.warn("[FactionService] Failed to preload faction colors:", err);
  }
}

/** Force a full refetch (sheet + colors). */
export async function refreshFactions(): Promise<void> {
  localStorage.removeItem(BOON_CACHE_KEY);
  localStorage.removeItem(COLOR_CACHE_KEY);
  sheetCache = null;
  colorCache = null;
  await preloadFactions();
}

/**
 * Every faction ID the app should recognize when routing Discord export
 * items into `inventory.consumables`. Always includes the fallback IDs so
 * a temporary sheet outage doesn't drop tokens.
 */
export async function getKnownFactionIds(): Promise<string[]> {
  try {
    const sheet = sheetCache ?? await buildFactionSheet();
    const merged = new Set<string>([...FALLBACK_FACTION_IDS, ...sheet.factionIds]);
    return Array.from(merged);
  } catch {
    return [...FALLBACK_FACTION_IDS];
  }
}

/**
 * Derives the list of unlocked boons for a character from their
 * `inventory.consumables`. Every faction the character has at least one
 * token in is scanned against FACTION_THRESHOLDS; each threshold they pass
 * produces one entry, populated from the sheet's boon metadata and colored
 * with the faction's hex from the Supabase `factions` table.
 *
 * Returns `[]` if nothing is unlocked — the caller should hide the section
 * entirely in that case.
 */
export async function getUnlockedBoons(
  consumables: Record<string, number> | undefined
): Promise<UnlockedBoon[]> {
  const c = consumables ?? {};

  const [sheet, colors] = await Promise.all([
    sheetCache ?? buildFactionSheet(),
    colorCache ?? buildColorMap().catch(() => ({}) as Record<string, string>),
  ]);

  // Case/format-insensitive lookup: normalize both sides the same way Sync
  // does when it stores faction tokens.
  const normalizeKey = (s: string) =>
    s.toLowerCase().replace(/[\s:_\-]+/g, "");

  const normalizedConsumables = new Map<string, number>();
  for (const [k, v] of Object.entries(c)) {
    normalizedConsumables.set(normalizeKey(k), Number(v) || 0);
  }

  const result: UnlockedBoon[] = [];

  for (const factionId of sheet.factionIds) {
    const tokens = normalizedConsumables.get(normalizeKey(factionId)) ?? 0;
    if (tokens <= 0) continue;

    const color = colors[factionId.toLowerCase()] ?? null;

    for (let i = 0; i < FACTION_THRESHOLDS.length; i++) {
      if (tokens < FACTION_THRESHOLDS[i]) break;
      const rankKey = sheet.rankOrder[i];
      if (!rankKey) continue;

      const meta = sheet.boonIndex[`${factionId.toUpperCase()}:${rankKey}`];
      if (!meta) continue;

      result.push({ ...meta, tokens, color });
    }
  }

  return result;
}