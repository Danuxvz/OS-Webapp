import { useEffect, useState } from "react";
import "../characterSheetStyles/InventorySection.scss";
import { db } from "../database/db";

// Food images (keep as in original)
import FOOD1 from "@/assets/FOOD/FOOD1.png";
import FOOD2 from "@/assets/FOOD/FOOD2.png";
import FOOD3 from "@/assets/FOOD/FOOD3.png";
import FOOD4 from "@/assets/FOOD/FOOD4.png";
import FOOD5 from "@/assets/FOOD/FOOD5.png";
import FOOD6 from "@/assets/FOOD/FOOD6.png";
import FOOD206 from "@/assets/FOOD/FOOD-206.png";
import FOOD207 from "@/assets/FOOD/FOOD-207.png";
import FOOD208 from "@/assets/FOOD/FOOD-208.png";

interface Props {
  characterId: number | null;
}

/* =====================
   TYPES
===================== */

type SectionKey = "cards" | "consumables";

interface ItemData {
  name: string;
  img: string;
  desc?: string;
}

type ItemMap = Record<string, ItemData>;

interface InventoryState {
  cards: Record<string, number>;
  consumables: Record<string, number>;
}

/* =====================
   ITEM DEFINITIONS 
===================== */

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

/* =====================
   MAIN COMPONENT
===================== */

export default function InventorySection({ characterId }: Props) {
  const [inventory, setInventory] = useState<InventoryState>({
    cards: {},
    consumables: {},
  });

  // Load inventory from Dexie
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
        });
      } else {
        // Create a new empty inventory record
        const newRecord = {
          characterId,
          cards: {},
          consumables: {},
          updatedAt: Date.now(),
          isDirty: true,
        };
        await db.inventory.add(newRecord);
        setInventory({ cards: {}, consumables: {} });
      }
    };

    loadInventory();
  }, [characterId]);

  // Update count and persist to Dexie
	const updateCount = async (section: SectionKey, id: string, delta: number) => {
	if (!characterId) return;

	setInventory((prev) => {
		const next = structuredClone(prev);
		const current = next[section][id] ?? 0;
		next[section][id] = Math.max(0, current + delta);

		// Persist to Dexie (callback version)
		db.inventory
		.where("characterId")
		.equals(characterId)
		.modify((obj) => {
			obj[section] = next[section];
			obj.updatedAt = Date.now();
			obj.isDirty = true;
		});

		return next;
	});
	};


  return (
    <div className="inventory-section container-fluid">
      <h2 className="mb-3">Inventory</h2>

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
    </div>
  );
}

/* =====================
   GRID COMPONENT
===================== */

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