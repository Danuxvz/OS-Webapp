import { useEffect, useState } from "react";
import type {
  Loadout,
  LoadoutHpSource,
  LoadoutWeaponSource,
  LoadoutHeSource,
  LoadoutACSource,
  LoadoutSlotSource,
  ArmorType,
} from "../../../types";
import LoadoutCard from "./LoadoutCard";
import { characterManager } from "../CharacterManager";
import { loadoutManager } from "./LoadoutManager";
import { getEnteMetadata } from "../../../services/enteMetadataService";
import "../characterSheetStyles/LoadoutSection.scss";

const CARDS: Record<string, { name: string; img: string }> = {
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
  Sobornar: { name: "Acción Diplomática (Sobornar)", img: "https://cdn.discordapp.com/emojis/1279228077691637760.webp?size=128" },
};

interface LoadoutSectionProps {
  characterId: number | null;
}

function parseAcMeta(raw: string | undefined): { type: ArmorType; name: string; bonus: number; text: string } {
  const text = (raw ?? "").trim();
  if (!text) {
    return { type: "Custom", name: "", bonus: 1, text: "" };
  }

  const [firstLine, ...rest] = text.split(/\r?\n/);
  const effectText = rest.join("\n");
  const bonusMatch = firstLine.match(/\+(\d+)\s*$/);
  const bonus = bonusMatch ? Number(bonusMatch[1]) : 1;

  const titlePart = bonusMatch ? firstLine.slice(0, bonusMatch.index).trim() : firstLine.trim();
  const [firstWord, ...titleParts] = titlePart.split(/\s+/);

  const validType = ["Lowgear", "Headgear", "Armor"].includes(firstWord)
    ? (firstWord as "Lowgear" | "Headgear" | "Armor")
    : "Custom";

  return {
    type: validType,
    name: validType === "Custom" ? titlePart : titleParts.join(" ").trim(),
    bonus,
    text: effectText,
  };
}

function LoadoutSection({ characterId }: LoadoutSectionProps) {
  const [loadouts, setLoadouts] = useState<Loadout[]>([]);
  const [hpSources, setHpSources] = useState<LoadoutHpSource[]>([]);
  const [atkSources, setAtkSources] = useState<LoadoutHpSource[]>([]);
  const [weaponSources, setWeaponSources] = useState<LoadoutWeaponSource[]>([]);
  const [heSources, setHeSources] = useState<LoadoutHeSource[]>([]);
  const [acSources, setAcSources] = useState<LoadoutACSource[]>([]);
  const [slotSources, setSlotSources] = useState<LoadoutSlotSource[]>([]);
  const [slotCardSources, setSlotCardSources] = useState<
    { cardId: string; name: string; image?: string; amount: number }[]
  >([]);

  async function buildHpSources(charId: number): Promise<LoadoutHpSource[]> {
    const [character, entes] = await Promise.all([
      characterManager.getCharacter(charId),
      characterManager.getEntes(charId),
    ]);

    if (!character) return [];

    const hpEntries = Object.entries(character.bonusLog?.hp ?? {});

    return Promise.all(
      hpEntries.map(async ([enteId, bonus]) => {
        const meta = await getEnteMetadata(enteId);
        const localEnte = entes.find((e) => e.enteID === enteId);
        return {
          enteId,
          name: meta?.name || localEnte?.enteID || enteId,
          image: meta?.image || localEnte?.customImage || "",
          bonus: Number(bonus) || 0,
          enabled: true,
        };
      })
    );
  }

  async function buildAtkSources(charId: number): Promise<LoadoutHpSource[]> {
    const [character, entes] = await Promise.all([
      characterManager.getCharacter(charId),
      characterManager.getEntes(charId),
    ]);

    if (!character) return [];

    const atkEntries = Object.entries(character.bonusLog?.atk ?? {});

    return Promise.all(
      atkEntries.map(async ([enteId, bonus]) => {
        const meta = await getEnteMetadata(enteId);
        const localEnte = entes.find((e) => e.enteID === enteId);
        return {
          enteId,
          name: meta?.name || localEnte?.enteID || enteId,
          image: meta?.image || localEnte?.customImage || "",
          bonus: Number(bonus) || 0,
          enabled: true,
        };
      })
    );
  }

  async function buildWeaponSources(charId: number): Promise<LoadoutWeaponSource[]> {
    const [character, entes] = await Promise.all([
      characterManager.getCharacter(charId),
      characterManager.getEntes(charId),
    ]);

    if (!character) return [];

    const equipped = entes.filter((e) => (e.amount ?? 0) > 0);

    return Promise.all(
      equipped.map(async (e) => {
        const meta = await getEnteMetadata(e.enteID);
        return {
          enteId: e.enteID,
          name: meta?.name || e.enteID,
          image: meta?.image || e.customImage || "",
          element: meta?.elemento || "",
          amount: e.amount ?? 0,
        };
      })
    );
  }

  async function buildHeSources(charId: number): Promise<LoadoutHeSource[]> {
    const [character, entes] = await Promise.all([
      characterManager.getCharacter(charId),
      characterManager.getEntes(charId),
    ]);

    if (!character) return [];

    const eligible = entes.filter((e) => (e.unlockLevel ?? 0) >= 3);

    return Promise.all(
      eligible.map(async (e) => {
        const meta = await getEnteMetadata(e.enteID);
        return {
          enteId: e.enteID,
          name: meta?.name || e.enteID,
          image: meta?.image || e.customImage || "",
          text: meta?.HE || "No HE text",
        };
      })
    );
  }

  async function buildAcSources(charId: number): Promise<LoadoutACSource[]> {
    const [character, entes] = await Promise.all([
      characterManager.getCharacter(charId),
      characterManager.getEntes(charId),
    ]);

    if (!character) return [];

    const eligible = entes.filter((e) => (e.unlockLevel ?? 0) >= 4);

    return Promise.all(
      eligible.map(async (e) => {
        const meta = await getEnteMetadata(e.enteID);
        const parsed = parseAcMeta(meta?.AC);
        return {
          enteId: e.enteID,
          name: meta?.name || e.enteID,
          image: meta?.image || e.customImage || "",
          text: meta?.AC || "",
          type: parsed.type,
          bonus: parsed.bonus,
        };
      })
    );
  }

  async function buildSlotSources(charId: number): Promise<LoadoutSlotSource[]> {
    const [character, entes] = await Promise.all([
      characterManager.getCharacter(charId),
      characterManager.getEntes(charId),
    ]);

    if (!character) return [];

    const slotEntries = Object.entries(character.bonusLog?.slots ?? {});

    return Promise.all(
      slotEntries.map(async ([enteId, bonus]) => {
        const meta = await getEnteMetadata(enteId);
        const localEnte = entes.find((e) => e.enteID === enteId);
        return {
          enteId,
          name: meta?.name || localEnte?.enteID || enteId,
          image: meta?.image || localEnte?.customImage || "",
          bonus: Number(bonus) || 0,
          enabled: true,
        };
      })
    );
  }

  async function buildSlotCardSources(charId: number) {
    const inv = await characterManager.getInventory(charId);
    if (!inv) return [];

    return Object.entries(inv.cards ?? {}).map(([cardId, amount]) => {
      const meta = CARDS[cardId];
      return {
        cardId,
        name: meta?.name ?? cardId,
        image: meta?.img ?? "",
        amount: Number(amount) || 0,
      };
    });
  }

  useEffect(() => {
    if (!characterId) {
      setLoadouts([]);
      setHpSources([]);
      setAtkSources([]);
      setWeaponSources([]);
      setHeSources([]);
      setAcSources([]);
      setSlotSources([]);
      setSlotCardSources([]);
      return;
    }

    loadoutManager.getByCharacter(characterId).then(setLoadouts);

    const refreshSources = async () => {
      const [hp, atk, weapon, he, ac, slotSrc, slotCards] = await Promise.all([
        buildHpSources(characterId),
        buildAtkSources(characterId),
        buildWeaponSources(characterId),
        buildHeSources(characterId),
        buildAcSources(characterId),
        buildSlotSources(characterId),
        buildSlotCardSources(characterId),
      ]);
      setHpSources(hp);
      setAtkSources(atk);
      setWeaponSources(weapon);
      setHeSources(he);
      setAcSources(ac);
      setSlotSources(slotSrc);
      setSlotCardSources(slotCards);
    };

    refreshSources();

    const handler = () => {
      refreshSources();
    };

    characterManager.on("characterUpdated", handler);
    characterManager.on("entesUpdated", handler);
    characterManager.on("inventoryUpdated", handler);

    return () => {
      characterManager.off("characterUpdated", handler);
      characterManager.off("entesUpdated", handler);
      characterManager.off("inventoryUpdated", handler);
    };
  }, [characterId]);

  const handleCreateLoadout = async () => {
    if (!characterId) return;

    const character = await characterManager.getCharacter(characterId);
    if (!character) return;

    const [currentHpSources, currentAtkSources, currentSlotSources] = await Promise.all([
      buildHpSources(characterId),
      buildAtkSources(characterId),
      buildSlotSources(characterId),
    ]);

    const newLoadout: Loadout = {
      id: "",
      characterId,
      name: `Loadout ${loadouts.length + 1}`,
      data: {
        hp: {
          baseMax: character.baseStats.hp,
          baseCurrent: character.baseStats.hp,
          tempBonus: 0,
          characterTempBonus: character.tempStatBonus.hp,
          sources: currentHpSources.map((s) => ({ ...s, enabled: true })),
          barriers: [], // initialize empty barriers
        },
        atk: {
          base: character.baseStats.atk,
          tempBonus: 0,
          characterTempBonus: character.tempStatBonus.atk,
          sources: currentAtkSources.map((s) => ({ ...s, enabled: true })),
        },
        weapon: {
          enteId: null,
          name: "",
          size: "",
          type: "",
          element: "",
          damageBonus: 0,
          image: "",
        },
        habilidadesPasivas: {
          max: 2,
          selectedIds: [],
        },
        armorClass: {
          enteId: null,
          type: "Custom",
          name: "",
          bonus: 1,
          text: "",
          image: "",
        },
        slots: {
          base: character.baseStats.slots,
          tempBonus: 0,
          characterTempBonus: character.tempStatBonus.slots,
          sources: currentSlotSources.map((s) => ({ ...s, enabled: true })),
          cards: [],
        },
        notes: "",
      },
    };

    const saved = await loadoutManager.create(newLoadout);
    setLoadouts((prev) => [...prev, saved]);
  };

  const handleDelete = async (loadout: Loadout) => {
    if (!loadout.id) return;
    await loadoutManager.markLoadoutDeleted(loadout.id);
    setLoadouts((prev) => prev.filter((l) => l.id !== loadout.id));
  };

  return (
    <section className="loadout-section card shadow-sm border-0">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
          <div>
            <h2 className="h4 mb-1">Loadout</h2>
            <div className="text-muted small">
              {characterId ? "Snapshot loadouts for this character." : "Select a character first."}
            </div>
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={handleCreateLoadout}
            disabled={!characterId}
          >
            + Create New Loadout
          </button>
        </div>

        {!characterId ? (
          <div className="alert alert-secondary mb-0">No character selected.</div>
        ) : loadouts.length === 0 ? (
          <div className="alert alert-light border mb-0">No loadouts yet. Create one to start.</div>
        ) : (
          <div className="d-grid gap-3">
            {loadouts.map((loadout) => (
              <LoadoutCard
                key={loadout.id}
                loadout={loadout}
                hpSources={hpSources}
                atkSources={atkSources}
                weaponSources={weaponSources}
                heSources={heSources}
                acSources={acSources}
                slotSources={slotSources}
                slotCardSources={slotCardSources}
                onUpdate={async (updated) => {
                  if (!characterId) return;
                  await loadoutManager.update(updated);
                  setLoadouts((prev) =>
                    prev.map((l) => (l.id === updated.id ? updated : l))
                  );
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default LoadoutSection;