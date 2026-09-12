import { useEffect, useState } from "react";
import "../characterSheetStyles/InventorySection.scss";
import { db } from "../database/db";
import { characterManager } from "../CharacterManager";
import { fetchCharacterBoons, type CharacterBoon } from "../../../services/FactionService";

// Food images
import FOOD1 from "@/assets/FOOD/FOOD1.png";
import FOOD2 from "@/assets/FOOD/FOOD2.png";
import FOOD3 from "@/assets/FOOD/FOOD3.png";
import FOOD4 from "@/assets/FOOD/FOOD4.png";
import FOOD5 from "@/assets/FOOD/FOOD5.png";
import FOOD6 from "@/assets/FOOD/FOOD6.png";
import FOOD206 from "@/assets/FOOD/FOOD-206.png";
import FOOD207 from "@/assets/FOOD/FOOD-207.png";
import FOOD208 from "@/assets/FOOD/FOOD-208.png";
import customItem from "@/assets/custom-item.png";

interface Props {
  characterId: number | null;
}

type SectionKey = "cards" | "consumables";

interface ItemData {
  name: string;
  img: string;
  desc?: string;
}

type ItemMap = Record<string, ItemData>;

interface CustomItem {
  id: string;
  title: string;
  desc: string;
  count: number;
}

interface InventoryState {
  cards: Record<string, number>;
  consumables: Record<string, number>;
  customItems: CustomItem[];
}

/* Shared image for all custom cards – replace the import above with your actual image */
const CUSTOM_CARD_IMG = customItem;

const CARDS: ItemMap = {
  AE_Card: { name: "AE Card", img: "https://cdn.discordapp.com/emojis/1279228009039138836.webp?size=128" },
  Basic_Attack: { name: "Basic Attack Card", img: "https://cdn.discordapp.com/emojis/1279227206157078569.webp?size=128" },
  Ethrielle: { name: "Ethrielle Card", img: "https://cdn.discordapp.com/emojis/1279227114213871718.webp?size=128" },
  Engaar: { name: "Acción Diplomática (Engaar)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
  Halagar: { name: "Acción Diplomática (Halagar)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
  Interpretar: { name: "Acción Diplomática (Interpretar)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
  Intimidar: { name: "Acción Diplomática (Intimidar)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
  Negociar: { name: "Acción Diplomática (Negociar)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
  Persuadir: { name: "Acción Diplomática (Persuadir)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
  Rogar: { name: "Acción Diplomática (Rogar)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
  Seducir: { name: "Acción Diplomática (Seducir)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
  Sobornar: { name: "Acción Diplomática (Sobornar)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" }
};

const CONSUMABLES: ItemMap = {
  KudagiBento: { name: "Kudagi Bento", desc: "Recupera un 25% de HP", img: FOOD1 },
  AstralDoguBento: { name: "Astral Dogu Bento", desc: "Recupera HP al azar", img: FOOD2 },
  GetStrongBento: { name: "Get Strong Bento", desc: "Recupera un 50% de HP", img: FOOD3 },
  ScarletSpectralMiso: { name: "Scarlet Spectral Miso", desc: "Recupera cartas", img: FOOD4 },
  ShellSushi: { name: "Shell Sushi", desc: "Recupera cartas", img: FOOD5 },
  SpicyFireRamen: { name: "Spicy Fire Ramen", desc: "Recupera cartas", img: FOOD6 },
  MomijiManju: { name: "Momiji Manju", desc: "+2 al dado", img: FOOD206 },
  MochisDeBaku: { name: "Mochis de Baku", desc: "+4 al dado", img: FOOD207 },
  TaiyakiKijyo: { name: "Taiyaki de Kijyo", desc: "+6 al dado", img: FOOD208 },
};

/* =========================
   FACTION CONSTANTS
   (mirror faction_progression.py)
========================= */

const FACTION_RANK_ORDER = ["A", "B", "C", "D", "E"] as const;
type FactionRank = (typeof FACTION_RANK_ORDER)[number];

const FACTION_RANK_NAMES: Record<FactionRank, string> = {
  A: "Notario",
  B: "Estenógrafo",
  C: "Jurado",
  D: "Fiscal",
  E: "Magistrado",
};

function makeId() {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* =========================
   FACTIONS SECTION (read-only)
========================= */

function FactionsSection({ characterId }: { characterId: number | null }) {
  const [boons, setBoons] = useState<CharacterBoon[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!characterId) {
      setBoons([]);
      setLoaded(true);
      return;
    }

    let cancelled = false;
    setLoaded(false);

    (async () => {
      try {
        const character = await characterManager.getCharacter(characterId);
        if (cancelled || !character) return;
        const result = await fetchCharacterBoons(character.charName);
        if (!cancelled) setBoons(result);
      } catch (err) {
        console.warn("Failed to load character boons:", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [characterId]);

  // The whole section hides until we've confirmed the character has boons.
  if (!loaded || boons.length === 0) return null;

  // Group boons by faction.
  const byFaction: Record<string, CharacterBoon[]> = {};
  for (const b of boons) {
    if (!byFaction[b.faction_id]) byFaction[b.faction_id] = [];
    byFaction[b.faction_id].push(b);
  }

  const factionIds = Object.keys(byFaction).sort();

  return (
    <div className="inv-section factions-section">
      <h3 className="mb-2">Factions</h3>

      <div className="faction-list">
        {factionIds.map((fid) => {
          const unlockedKeys = new Set(
            byFaction[fid].map((b) => b.boon_key.toUpperCase())
          );

          // Current rank = highest unlocked boon.
          let currentRank: FactionRank | null = null;
          for (let i = FACTION_RANK_ORDER.length - 1; i >= 0; i--) {
            if (unlockedKeys.has(FACTION_RANK_ORDER[i])) {
              currentRank = FACTION_RANK_ORDER[i];
              break;
            }
          }

          return (
            <div key={fid} className="faction-card">
              <div className="faction-header">
                <span className="faction-name">{fid}</span>
                <span className="faction-current">
                  Current:{" "}
                  <b>{currentRank ? FACTION_RANK_NAMES[currentRank] : "—"}</b>
                </span>
              </div>

              <div className="faction-ranks">
                {FACTION_RANK_ORDER.map((key) => {
                  const unlocked = unlockedKeys.has(key);
                  return (
                    <div
                      key={key}
                      className={`rank-chip ${unlocked ? "unlocked" : "locked"}`}
                      title={FACTION_RANK_NAMES[key]}
                    >
                      <span className="rank-letter">{key}</span>
                      <span className="rank-name">{FACTION_RANK_NAMES[key]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   INVENTORY SECTION
========================= */

export default function InventorySection({ characterId }: Props) {
  const [inventory, setInventory] = useState<InventoryState>({
    cards: {},
    consumables: {},
    customItems: [],
  });

  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDesc, setCustomDesc] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    if (!characterId) return;

    const loadInventory = async () => {
      const record = await db.inventory
        .where("characterId")
        .equals(characterId)
        .first();

      if (record) {
        setInventory({
          cards: record.cards ?? {},
          consumables: record.consumables ?? {},
          customItems: record.customItems ?? [],
        });
      } else {
        const newRecord = {
          characterId,
          cards: {},
          consumables: {},
          customItems: [],
          updatedAt: Date.now(),
          isDirty: true,
        };
        await db.inventory.add(newRecord);
        setInventory({ cards: {}, consumables: {}, customItems: [] });
      }
    };

    loadInventory();
  }, [characterId]);

  const persistInventory = async (next: InventoryState) => {
    if (!characterId) return;

    setInventory(next);

    const record = await db.inventory
      .where("characterId")
      .equals(characterId)
      .first();

    if (!record) return;

    await db.inventory.update(record.id!, {
      cards: next.cards,
      consumables: next.consumables,
      customItems: next.customItems,
      updatedAt: Date.now(),
      isDirty: true,
    });
  };

  const updateCount = async (section: SectionKey, id: string, delta: number) => {
    if (!characterId) return;

    const next = structuredClone(inventory);
    const current = next[section][id] ?? 0;
    next[section][id] = Math.max(0, current + delta);

    await persistInventory(next);
  };

  const addCustomItem = async () => {
    if (!customTitle.trim()) return;

    const next = structuredClone(inventory);
    next.customItems.push({
      id: makeId(),
      title: customTitle.trim(),
      desc: customDesc.trim(),
      count: 1,
    });

    await persistInventory(next);
    setCustomTitle("");
    setCustomDesc("");
    setIsCreatingCustom(false);
  };

  const updateCustomCount = async (id: string, delta: number) => {
    const next = structuredClone(inventory);
    const item = next.customItems.find((it) => it.id === id);
    if (!item) return;

    item.count = Math.max(0, item.count + delta);

    if (item.count === 0) {
      next.customItems = next.customItems.filter((it) => it.id !== id);
    }

    await persistInventory(next);
  };

  const startEditing = (item: CustomItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDesc(item.desc);
  };

  const saveEdit = async () => {
    if (!editingId) return;

    const next = structuredClone(inventory);
    const item = next.customItems.find((it) => it.id === editingId);
    if (!item) return;

    item.title = editTitle.trim() || item.title;
    item.desc = editDesc.trim();

    await persistInventory(next);
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="inventory-section container-fluid">
      <h2 className="mb-3">Inventory</h2>

      {/* Factions panel — hidden unless the character has unlocked a boon */}
      <FactionsSection characterId={characterId} />

      <InventoryGrid
        title="Cards"
        section="cards"
        data={CARDS}
        inventory={inventory}
        onChange={updateCount}
      />

      <InventoryGrid
        title="Consumibles"
        section="consumables"
        data={CONSUMABLES}
        inventory={inventory}
        onChange={updateCount}
      />

      {/* Custom Section – Horizontal rows */}
      <div className="inv-section">
        <h3 className="mb-2">Custom</h3>

        <div className="custom-list">
          {inventory.customItems.map((item) => (
            <div key={item.id} className="custom-card">
              <div
                className="custom-count"
                onClick={(e) => {
                  e.stopPropagation();
                  updateCustomCount(item.id, 1);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  updateCustomCount(item.id, -1);
                }}
                title="Left-click +1 / Right-click -1"
              >
                x{item.count}
              </div>

              <img src={CUSTOM_CARD_IMG} alt="" className="custom-icon" />

              <div className="custom-text">
                {editingId === item.id ? (
                  <div className="custom-edit-form">
                    <input
                      className="custom-edit-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                      autoFocus
                    />
                    <textarea
                      className="custom-edit-desc"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Description"
                      rows={2}
                    />
                    <div className="custom-edit-buttons">
                      <button onClick={saveEdit}>Save</button>
                      <button onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => startEditing(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="custom-title">{item.title}</div>
                    <div className="custom-desc">{item.desc}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div
          className="custom-add-btn"
          onClick={() => setIsCreatingCustom(true)}
        >
          + Add custom card
        </div>

        {isCreatingCustom && (
          <div className="custom-item-editor">
            <input
              className="form-control mb-2"
              placeholder="Title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
            <textarea
              className="form-control mb-2"
              placeholder="Description"
              rows={3}
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
            />
            <div className="d-flex gap-2">
              <button className="btn btn-primary" onClick={addCustomItem}>
                Add item
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setIsCreatingCustom(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface InventoryGridProps {
  title: string;
  section: SectionKey;
  data: ItemMap;
  inventory: InventoryState;
  onChange: (section: SectionKey, id: string, delta: number) => void;
}

function InventoryGrid({
  title,
  section,
  data,
  inventory,
  onChange,
}: InventoryGridProps) {
  return (
    <div className="inv-section">
      <h3 className="mb-2">{title}</h3>

      <div className="inv-grid">
        {Object.entries(data).map(([id, item]) => {
          const count = inventory[section][id] ?? 0;

          return (
            <div
              key={id}
              className="inv-slot"
              title={item.desc ?? ""}
              onClick={() => onChange(section, id, 1)}
              onContextMenu={(e) => {
                e.preventDefault();
                onChange(section, id, -1);
              }}
            >
              <img
                src={item.img}
                alt={item.name}
                className="inv-img"
                style={{
                  filter: count === 0 ? "grayscale(1)" : "grayscale(0)",
                }}
              />
              <div className="inv-label">{item.name}</div>
              <div className="inv-count">x{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}