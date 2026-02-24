/* =========================
   CONFIG
========================= */

const BASE_SHEET_ID = "1dMUMUXjn22L2nYHFHKmDBObD1VskyVruzh-OM9IexLk";
const RANKS_SHEET_ID = "1Yjl6UkgZCYHw2yieZHU5aCz4y1ZDh8jI0_NZ35tFYKY";

const SHEET_MAP: Record<string, string> = {
  C: "RANGOS C",
  D: "RANGOS D",
  E: "RANGOS E"
};

const LOCAL_CACHE_KEY = "ente_metadata_cache_v1";

/* =========================
   TYPES
========================= */

export interface EnteMetadata {
  id: string;
  name: string;
  clase: string;
  elemento: string;
  rank: string;
  AE: string;
  SB: string;
  HE: string;
  AC: string;
  image: string;
}

interface BaseRow {
  id: string;
  name: string;
  tier: string;
  clase: string;
  elemento: string;
}

interface RankRow {
  id: string;
  AE: string;
  SB: string;
  HE: string;
  AC: string;
}

/* =========================
   INTERNAL MEMORY CACHE
========================= */

let metadataIndex: Record<string, EnteMetadata> | null = null;

/* =========================
   VARIANT CONFIG
========================= */

const SPECIAL_E_VARIANT_BASES: Record<string, string> = {
  E005: "E005A",
  E060: "E060A",
  E052: "E052A"
};

/* =========================
   HELPERS
========================= */

async function fetchGviz(spreadsheetId: string, sheetName: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url);
  const text = await res.text();

  const jsonText = text.substring(
    text.indexOf("{"),
    text.lastIndexOf("}") + 1
  );

  return JSON.parse(jsonText).table;
}

function normalizeId(raw: any): string {
  if (raw === null || raw === undefined) return "";

  if (typeof raw === "number") {
    return `E${raw.toString().padStart(3, "0")}`;
  }

  const str = raw.toString().trim();
  if (!str) return "";

  if (/^E\d{3}$/i.test(str)) {
    return str.toUpperCase();
  }

  if (/^\d+$/.test(str)) {
    return `E${str.padStart(3, "0")}`;
  }

  return str.toUpperCase();
}

function normalizeTier(raw: any): string {
  if (!raw) return "";

  const str = raw.toString().trim().toUpperCase();

  if (str.includes("C")) return "C";
  if (str.includes("D")) return "D";
  if (str.includes("E")) return "E";

  return str;
}

function getLocalImageUrl(id: string, rank: string) {
  return `/RANK_${rank}/${id}.png`;
}

/* =========================
   INHERITANCE RESOLUTION
========================= */

function resolveParentId(
  id: string,
  rank: string,
  hasEntry?: (candidateId: string) => boolean
): string | null {
  id = (id || "").toUpperCase();

  // C Tier variants: keep existing behavior
  if (rank === "C" && /^C0\d{2}[A-Z]$/i.test(id)) {
    return id.substring(0, 4);
  }

  // Only E-tier variants use this progressive-trim inheritance
  if (rank === "E" && /^E\d{3}[A-Z]+$/i.test(id)) {
    // Try progressively shorter candidates (most specific -> least)
    let candidate = id;

    while (candidate.length > 4) {
      candidate = candidate.slice(0, -1);

      if (typeof hasEntry === "function") {
        if (hasEntry(candidate)) return candidate;
      } else {
        return candidate;
      }
    }

    const baseKey = candidate.substring(0, 4);
    const special = SPECIAL_E_VARIANT_BASES[baseKey];
    if (special) {
      if (typeof hasEntry === "function") {
        if (hasEntry(special)) return special;
        if (hasEntry(candidate)) return candidate;
        return null;
      } else {
        return special;
      }
    }

    if (typeof hasEntry === "function") {
      if (hasEntry(candidate)) return candidate;
      return null;
    }

    return candidate;
  }

  return null;
}

/* =========================
   BUILD FULL INDEX
========================= */

async function buildMetadataIndex(): Promise<Record<string, EnteMetadata>> {

  // 1️⃣ Try localStorage first
  const cached = localStorage.getItem(LOCAL_CACHE_KEY);
  if (cached) {
    try {
      metadataIndex = JSON.parse(cached);
      return metadataIndex!;
    } catch {
      localStorage.removeItem(LOCAL_CACHE_KEY);
    }
  }

  /* =========================
     FETCH BASE SHEET
  ========================= */

  const baseTable = await fetchGviz(BASE_SHEET_ID, "BASE");

  const BASE_HEADERS = ["id", "name", "tier", "rutas", "clase", "elemento"];

  const baseRows: BaseRow[] = baseTable.rows
    .map((row: any): BaseRow | null => {

      const obj: any = {};

      BASE_HEADERS.forEach((header, i) => {
        const cell = row.c[i];
        obj[header] = cell && "v" in cell ? cell.v : "";
      });

      const id = normalizeId(obj.id);
      if (!id) return null;

      return {
        id,
        name: obj.name ?? "",
        tier: normalizeTier(obj.tier),
        clase: obj.clase ?? "",
        elemento: obj.elemento ?? ""
      };
    })
    .filter(Boolean) as BaseRow[];

  /* =========================
     FETCH RANK SHEETS
  ========================= */

  const ranksData: Record<string, Record<string, RankRow>> = {};

  for (const rank of Object.keys(SHEET_MAP)) {

    const table = await fetchGviz(RANKS_SHEET_ID, SHEET_MAP[rank]);

    const rows: RankRow[] = table.rows
      .map((row: any): RankRow | null => {

        const id = normalizeId(row.c[0]?.v);
        if (!id) return null;

        return {
          id,
          AE: row.c[2]?.v ?? "",
          SB: row.c[3]?.v ?? "",
          HE: row.c[4]?.v ?? "",
          AC: [row.c[5]?.v, row.c[6]?.v]
            .filter(Boolean)
            .join(" ")
        };
      })
      .filter(Boolean) as RankRow[];

    ranksData[rank] = {};

    rows.forEach(r => {
      ranksData[rank][r.id] = r;
    });
  }

  /* =========================
     MERGE BASE + RANKS
  ========================= */

  const finalIndex: Record<string, EnteMetadata> = {};

  baseRows.forEach(base => {

    const rank = normalizeTier(base.tier);
    const rankRow = ranksData[rank]?.[base.id];

    finalIndex[base.id] = {
      id: base.id,
      name: base.name,
      clase: base.clase,
      elemento: base.elemento,
      rank,
      AE: rankRow?.AE ?? "",
      SB: rankRow?.SB ?? "",
      HE: rankRow?.HE ?? "",
      AC: rankRow?.AC ?? "",
      image: getLocalImageUrl(base.id, rank)
    };
  });

	// create rank-only entries without inheritance
	Object.keys(ranksData).forEach(rank => {

		Object.values(ranksData[rank]).forEach(rankRow => {

			if (finalIndex[rankRow.id]) return;

			finalIndex[rankRow.id] = {
				id: rankRow.id,
				name: rankRow.id,
				clase: "",
				elemento: "",
				rank,
				AE: rankRow.AE ?? "",
				SB: rankRow.SB ?? "",
				HE: rankRow.HE ?? "",
				AC: rankRow.AC ?? "",
				image: getLocalImageUrl(rankRow.id, rank)
			};

		});

	});

	// resolve inheritance AFTER all entries exist
	Object.values(finalIndex).forEach(entry => {

		const parentId = resolveParentId(entry.id, entry.rank);
		if (!parentId) return;

		const parent = finalIndex[parentId];
		if (!parent) return;

		// Only E tier inherits rank stats
		if (entry.rank === "E") {
			entry.AE = entry.AE || parent.AE;
			entry.SB = entry.SB || parent.SB;
			entry.HE = entry.HE || parent.HE;
			entry.AC = entry.AC || parent.AC;
		}

		// C tier keeps previous behavior if needed
	});

  // Save cache
  metadataIndex = finalIndex;
  localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(finalIndex));

  return finalIndex;
}

/* =========================
   PUBLIC API
========================= */

export async function getEnteMetadata(id: string): Promise<EnteMetadata | null> {
  if (!metadataIndex) {
    await buildMetadataIndex();
  }
  return metadataIndex?.[normalizeId(id)] ?? null;
}

export async function refreshMetadata() {
  localStorage.removeItem(LOCAL_CACHE_KEY);
  metadataIndex = null;
  await buildMetadataIndex();
}

export async function preloadMetadata() {
  if (!metadataIndex) {
    await buildMetadataIndex();
  }
}

export async function getAllEnteMetadata(): Promise<Record<string, EnteMetadata>> {
  if (!metadataIndex) {
    await buildMetadataIndex();
  }
  return metadataIndex!;
}