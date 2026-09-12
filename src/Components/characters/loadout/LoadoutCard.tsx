import type {
  Loadout,
  LoadoutHpSource,
  LoadoutWeaponSource,
  LoadoutHeSource,
  LoadoutACSource,
  LoadoutSlotSource,
} from "../../../types";
import { useState, useEffect, useRef } from "react";
import LoadoutPopup from "./LoadoutPopup";

interface Props {
  loadout: Loadout;
  hpSources: LoadoutHpSource[];
  atkSources: LoadoutHpSource[];
  weaponSources: LoadoutWeaponSource[];
  heSources: LoadoutHeSource[];
  aeSources: LoadoutHeSource[];
  acSources: LoadoutACSource[];
  slotSources: LoadoutSlotSource[];
  slotCardSources: { cardId: string; name: string; image?: string; amount: number }[];
  isNpcMode?: boolean;
  onUpdate: (loadout: Loadout) => void;
  onDelete: (loadout: Loadout) => void;
}

const emptyLoadoutData = {
  hp: { baseMax: 0, baseCurrent: 0, tempBonus: 0, characterTempBonus: 0, sources: [], barriers: [] },
  atk: { base: 0, tempBonus: 0, characterTempBonus: 0, sources: [] },
  weapon: { enteId: null, name: "", size: "", type: "", element: "", damageBonus: 0, image: "" },
  habilidadesPasivas: { max: 2, selectedIds: [] },
  armorClass: { enteId: null, type: "Custom", name: "", bonus: 1, text: "", image: "" },
  slots: { base: 0, tempBonus: 0, characterTempBonus: 0, sources: [], cards: [] },
  notes: "",
  customHE: [],
  customACs: [],
  customWeapons: [],
  habilidadesActivas: [],
  activeAEIds: [],
  selectedActivaIds: [],
};

interface NormalizedSlotCard {
  cardId: string;
  quantity: number;
  usedIndices: number[];
}

interface NormalizedSlots {
  base: number;
  tempBonus: number;
  characterTempBonus: number;
  sources: LoadoutSlotSource[];
  cards: NormalizedSlotCard[];
}

function normalizeSlots(raw: any): NormalizedSlots {
  if (!raw) {
    return { base: 0, tempBonus: 0, characterTempBonus: 0, sources: [], cards: [] };
  }
  return {
    base:
      typeof raw.base === "number"
        ? raw.base
        : typeof raw.max === "number"
        ? raw.max
        : 0,
    tempBonus: typeof raw.tempBonus === "number" ? raw.tempBonus : 0,
    characterTempBonus:
      typeof raw.characterTempBonus === "number" ? raw.characterTempBonus : 0,
    sources: Array.isArray(raw.sources) ? (raw.sources as LoadoutSlotSource[]) : [],
    cards: Array.isArray(raw.cards)
      ? (raw.cards as NormalizedSlotCard[]).map((c) => ({
          cardId: String(c.cardId),
          quantity: Number(c.quantity) || 0,
          usedIndices: Array.isArray(c.usedIndices)
            ? c.usedIndices.filter((i) => typeof i === "number")
            : [],
        }))
      : [],
  };
}

/**
 * Merge live sources with the saved snapshot. The saved array is the
 * authoritative record of which sources were part of this loadout and which
 * the user enabled/disabled.
 *
 * Crucial default: any source present in `live` but NOT in `saved` was added
 * to the character AFTER this loadout was created. Those default to DISABLED
 * so they don't silently inflate the loadout's totals — the user must opt in
 * per-loadout. This is what keeps old loadouts stable as the ente collection
 * grows.
 */
function mergeLiveWithSaved<T extends { enteId: string; enabled?: boolean }>(
  live: T[],
  saved: T[] | undefined
): T[] {
  const savedMap = new Map((saved ?? []).map((s) => [s.enteId, s]));
  return live.map((l) => {
    const s = savedMap.get(l.enteId);
    return { ...l, enabled: s?.enabled ?? false };
  });
}

function LoadoutCard({
  loadout,
  hpSources,
  atkSources,
  weaponSources,
  heSources,
  aeSources,
  acSources,
  slotSources,
  slotCardSources,
  isNpcMode = false,
  onUpdate,
  onDelete,
}: Props) {
  const [popupSection, setPopupSection] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const loadoutRef = useRef(loadout);
  useEffect(() => {
    loadoutRef.current = loadout;
  }, [loadout]);

  const data = loadout.data ?? emptyLoadoutData;

  const [localName, setLocalName] = useState(loadout.name);
  const [localHpCurrent, setLocalHpCurrent] = useState(
    String(data.hp?.baseCurrent ?? 0)
  );
  const [localBarrierAmounts, setLocalBarrierAmounts] = useState<Record<string, string>>(
    () => {
      const barriers = data.hp?.barriers ?? [];
      const map: Record<string, string> = {};
      barriers.forEach((b) => {
        map[b.id] = String(b.amount);
      });
      return map;
    }
  );
  const [localNotes, setLocalNotes] = useState(data.notes ?? "");

  useEffect(() => {
    setLocalName(loadout.name);
    setLocalHpCurrent(String(loadout.data?.hp?.baseCurrent ?? 0));
    setLocalNotes(loadout.data?.notes ?? "");
    const barriers = loadout.data?.hp?.barriers ?? [];
    const newMap: Record<string, string> = {};
    barriers.forEach((b) => {
      newMap[b.id] = String(b.amount);
    });
    setLocalBarrierAmounts(newMap);
  }, [loadout.id, loadout.data?.hp?.baseCurrent, loadout.data?.notes, loadout.data?.hp?.barriers]);

  const hp = data.hp ?? emptyLoadoutData.hp;
  const atk = data.atk ?? emptyLoadoutData.atk;
  const weapon = data.weapon ?? emptyLoadoutData.weapon;
  const he = data.habilidadesPasivas ?? emptyLoadoutData.habilidadesPasivas;
  const armorClass = data.armorClass ?? emptyLoadoutData.armorClass;
  const slots = normalizeSlots(data.slots);
  const notes = data.notes ?? "";
  const customHE = data.customHE ?? [];
  const customActivas = data.habilidadesActivas ?? [];
  const activeAEIds = data.activeAEIds ?? [];

  const liveHpSources = mergeLiveWithSaved(hpSources, hp.sources);
  const liveAtkSources = mergeLiveWithSaved(atkSources, atk.sources);
  const liveSlotSources = mergeLiveWithSaved(slotSources, slots.sources);

  const enabledHpBonus = liveHpSources
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.bonus || 0), 0);

  const totalHP =
    (hp.baseMax || 0) +
    (hp.characterTempBonus || 0) +
    (hp.tempBonus || 0) +
    enabledHpBonus;

  const enabledAtkBonus = liveAtkSources
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.bonus || 0), 0);

  const totalATK =
    (atk.base || 0) +
    (atk.characterTempBonus || 0) +
    (atk.tempBonus || 0) +
    enabledAtkBonus;

  const hpPercent = totalHP > 0 ? ((hp.baseCurrent || 0) / totalHP) * 100 : 0;

  const weaponDetails = [weapon.size, weapon.element].filter(Boolean).join(" · ");

  const customSelectedHE = customHE
    .filter((c) => he.selectedIds.includes(c.id))
    .map((c) => ({
      enteId: c.id,
      firstLine: c.name,
      restLines: c.text,
      image: c.image || "",
    }));

  const regularSelectedHE = heSources
    .filter((s) => he.selectedIds.includes(s.enteId))
    .map((s) => ({
      enteId: s.enteId,
      firstLine: s.text.split("\n")[0],
      restLines: s.text.split("\n").slice(1).join("\n"),
      image: s.image,
    }));

  const selectedHE = [...customSelectedHE, ...regularSelectedHE];

  const selectedCustomActivas = customActivas.map((a) => ({
    id: a.id,
    name: a.name,
    restText: a.text,
    image: "",
  }));

  const selectedAEActivas = aeSources
    .filter((s) => activeAEIds.includes(s.enteId))
    .map((s) => ({
      id: s.enteId,
      name: s.text.split("\n")[0] || s.name,
      restText: s.text.split("\n").slice(1).join("\n"),
      image: s.image,
    }));

  const selectedActivas = [...selectedCustomActivas, ...selectedAEActivas];

  const acLines = (armorClass.text || "").split("\n");
  const acTitleLine = acLines[0] || "";
  const acEffectText = acLines.slice(1).join("\n");
  const acDisplay = armorClass.type === "Custom" && !armorClass.name
    ? "None"
    : `${armorClass.type} ${armorClass.name} +${armorClass.bonus}`;

  const enabledSlotBonus = liveSlotSources
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.bonus || 0), 0);

  const totalSlots =
    (slots.base || 0) +
    (slots.characterTempBonus || 0) +
    (slots.tempBonus || 0) +
    enabledSlotBonus;

  interface SlotBoxItem {
    cardId: string;
    index: number;
    used: boolean;
  }

  const slotBoxItems: SlotBoxItem[] = slots.cards.flatMap((card) =>
    Array.from({ length: card.quantity }, (_, index) => ({
      cardId: card.cardId,
      index,
      used: card.usedIndices.includes(index),
    }))
  );

  const usedSlots = slotBoxItems.filter((item: SlotBoxItem) => item.used).length;

  const handleToggleSlot = (cardId: string, index: number) => {
    const currentLoadout = loadoutRef.current;
    const currentData = currentLoadout.data ?? emptyLoadoutData;
    const currentSlots = normalizeSlots(currentData.slots);

    const nextCards = currentSlots.cards.map((c) => ({
      ...c,
      usedIndices: [...c.usedIndices],
    }));

    const card = nextCards.find((c) => c.cardId === cardId);
    if (!card) return;

    const usedSet = new Set<number>(card.usedIndices);
    const totalUsed = nextCards.reduce(
      (sum, c) => sum + c.usedIndices.length,
      0
    );

    if (usedSet.has(index)) {
      usedSet.delete(index);
    } else {
      if (totalUsed >= totalSlots) return;
      usedSet.add(index);
    }

    card.usedIndices = Array.from(usedSet).sort(
      (a: number, b: number) => a - b
    );

    onUpdate({
      ...currentLoadout,
      data: {
        ...currentData,
        slots: {
          ...currentSlots,
          cards: nextCards,
        },
      },
    });
  };

  const handleDeleteClick = () => {
    if (window.confirm(`Are you sure you want to delete the loadout "${loadout.name}"? This action cannot be undone.`)) {
      onDelete(loadout);
    }
  };

  const barriers = hp.barriers ?? [];

  const updateHp = (nextHp: typeof hp) => {
    const currentLoadout = loadoutRef.current;
    onUpdate({
      ...currentLoadout,
      data: {
        ...currentLoadout.data,
        hp: nextHp,
      },
    });
  };

  const updateBarrier = (id: string, amount: number) => {
    const currentLoadout = loadoutRef.current;
    const currentHp = currentLoadout.data?.hp ?? emptyLoadoutData.hp;
    updateHp({
      ...currentHp,
      barriers: (currentHp.barriers ?? []).map((b) =>
        b.id === id ? { ...b, amount: Math.max(0, amount) } : b
      ),
    });
  };

  const deleteBarrier = (id: string) => {
    const currentLoadout = loadoutRef.current;
    const currentHp = currentLoadout.data?.hp ?? emptyLoadoutData.hp;
    updateHp({
      ...currentHp,
      barriers: (currentHp.barriers ?? []).filter((b) => b.id !== id),
    });
  };

  const commitName = () => {
    const currentLoadout = loadoutRef.current;
    if (localName !== currentLoadout.name) {
      onUpdate({ ...currentLoadout, name: localName });
    }
  };

  const commitHpCurrent = () => {
    const currentLoadout = loadoutRef.current;
    const currentHp = currentLoadout.data?.hp ?? emptyLoadoutData.hp;
    const num = Number(localHpCurrent);
    if (!isNaN(num) && num !== currentHp.baseCurrent) {
      updateHp({ ...currentHp, baseCurrent: num });
    }
  };

  const commitBarrier = (id: string) => {
    const raw = localBarrierAmounts[id];
    const num = Number(raw);
    const currentLoadout = loadoutRef.current;
    const currentHp = currentLoadout.data?.hp ?? emptyLoadoutData.hp;
    const barrier = (currentHp.barriers ?? []).find((b) => b.id === id);
    if (!isNaN(num) && barrier && num !== barrier.amount) {
      updateBarrier(id, num);
    }
  };

  const commitNotes = () => {
    const currentLoadout = loadoutRef.current;
    if (localNotes !== (currentLoadout.data?.notes ?? "")) {
      onUpdate({
        ...currentLoadout,
        data: {
          ...currentLoadout.data,
          notes: localNotes,
        },
      });
    }
  };

  const handleBarrierLocalChange = (id: string, value: string) => {
    setLocalBarrierAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const commitOnEnter = (handler: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
      handler();
    }
  };

  return (
    <div className="loadout-card card shadow-sm border-0">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div className="flex-grow-1">
            {configOpen ? (
              <input
                className="form-control form-control-lg mb-2"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={commitName}
                onKeyDown={commitOnEnter(commitName)}
              />
            ) : (
              <h3 className="h3 mb-1">{loadout.name}</h3>
            )}
          </div>

          <button
            className={`btn btn-sm ${configOpen ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setConfigOpen((prev) => !prev)}
            title="Master config"
          >
            ⚙
          </button>
        </div>

        {/* HP section */}
        <div className="mb-2">
          <div className="progress mb-2" style={{ height: "0.7rem" }}>
            <div
              className="progress-bar"
              style={{ width: `${Math.max(0, Math.min(hpPercent, 100))}%` }}
            />
          </div>

          {barriers.length > 0 && (
            <div className="mt-1">
              {barriers.map((barrier) => {
                const pct = totalHP > 0 ? Math.min((barrier.amount / totalHP) * 100, 100) : 0;
                return (
                  <div key={barrier.id} className="mb-1">
                    <div className="progress" style={{ height: "0.25rem" }}>
                      <div
                        className="progress-bar bg-info"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
            <span className="fw-semibold">HP:</span>
            <input
              className="form-control form-control-sm"
              style={{ maxWidth: "7rem" }}
              value={localHpCurrent}
              onChange={(e) => setLocalHpCurrent(e.target.value)}
              onBlur={commitHpCurrent}
              onKeyDown={commitOnEnter(commitHpCurrent)}
            />
            <span className="text-muted">/ {totalHP}</span>

            {configOpen && (
              <button
                className="btn btn-link btn-sm p-0"
                onClick={() => setPopupSection("hp")}
              >
                ⚙
              </button>
            )}

            {barriers.map((barrier) => (
              <div key={barrier.id} className="d-flex align-items-center gap-1">
                <input
                  className="form-control form-control-sm ms-4"
                  style={{ maxWidth: "3rem" }}
                  type="text"
                  value={localBarrierAmounts[barrier.id] ?? ""}
                  onChange={(e) => handleBarrierLocalChange(barrier.id, e.target.value)}
                  onBlur={() => commitBarrier(barrier.id)}
                  onKeyDown={commitOnEnter(() => commitBarrier(barrier.id))}
                />
                {configOpen && (
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => deleteBarrier(barrier.id)}
                    title="Eliminar barrera"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ATK + Weapon row */}
        <div className="mb-2 d-flex align-items-center gap-3 flex-wrap">
          <span className="fw-semibold">ATK:</span>
          <span className="fw-bold">+{totalATK}</span>
          {configOpen && (
            <button
              className="btn btn-link btn-sm p-0"
              onClick={() => setPopupSection("atk")}
            >
              ⚙
            </button>
          )}

          <span className="text-muted">|</span>

          {weapon.name ? (
            <>
              <span className="fw-semibold">{weapon.name}</span>
              <span>+{weapon.damageBonus}</span>
              {weaponDetails && (
                <span className="text-muted small ms-1">({weaponDetails})</span>
              )}
            </>
          ) : (
            <>
              <span className="fw-semibold">Anrima:</span>
              <b>None</b>
            </>
          )}
          {configOpen && (
            <button
              className="btn btn-link btn-sm p-0"
              onClick={() => setPopupSection("weapon")}
            >
              ⚙
            </button>
          )}
        </div>

        {/* HE Display */}
        <div className="mb-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="h5 mt-3 fw-bold">Habilidades Pasivas:</span>
            {configOpen && (
              <button
                className="btn btn-link btn-sm p-0"
                onClick={() => setPopupSection("he")}
              >
                ⚙
              </button>
            )}
          </div>
          <div className="mt-2">
            {selectedHE.length === 0 ? (
              <span className="text-muted small">None</span>
            ) : (
              selectedHE.map((s) => (
                <div key={s.enteId} className="he-card-inline mb-1">
                  <b>{s.firstLine}</b>
                  {s.restLines && <div className="small text-muted">{s.restLines}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* AC Display */}
        <div className="mb-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="h5 mt-3 fw-bold">Armor Class:</span>
            {configOpen && (
              <button
                className="btn btn-link btn-sm p-0"
                onClick={() => setPopupSection("ac")}
              >
                ⚙
              </button>
            )}
          </div>
          <div className="mt-2">
            <span>{acDisplay}</span>
            {armorClass.text && (
              <div className="small text-muted mt-1">
                {acEffectText || acTitleLine}
              </div>
            )}
          </div>
        </div>

        {/* Slots display – hidden in NPC mode */}
        {!isNpcMode && (
          <div className="mb-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="h5 mt-3 fw-bold">Slots:</span>
              <span>
                {Math.max(0, totalSlots - usedSlots)} / {totalSlots}
              </span>
              {configOpen && (
                <button
                  className="btn btn-link btn-sm p-0"
                  onClick={() => setPopupSection("slots")}
                >
                  ⚙
                </button>
              )}
            </div>
            {slotBoxItems.length > 0 && (
              <div className="slot-grid mt-2">
                {slotBoxItems.map((item: SlotBoxItem) => {
                  const cardMeta = slotCardSources.find(
                    (c) => c.cardId === item.cardId
                  );
                  return (
                    <div
                      key={`${item.cardId}-${item.index}`}
                      className={`slot-box ${item.used ? "used" : ""}`}
                      onClick={() => handleToggleSlot(item.cardId, item.index)}
                    >
                      {cardMeta?.image && (
                        <img
                          src={cardMeta.image}
                          alt={cardMeta.name}
                          className="slot-box-img"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Habilidades Activas (NPC only) */}
        {isNpcMode && (
          <div className="mb-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="h5 mt-3 fw-bold">Habilidades Activas:</span>
              {configOpen && (
                <button
                  className="btn btn-link btn-sm p-0"
                  onClick={() => setPopupSection("activas")}
                >
                  ⚙
                </button>
              )}
            </div>
            <div className="mt-2">
              {selectedActivas.length === 0 ? (
                <span className="text-muted small">None</span>
              ) : (
                selectedActivas.map((s) => (
                  <div key={s.id} className="he-card-inline mb-1">
                    <b>{s.name}</b>
                    {s.restText && <div className="small text-muted">{s.restText}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mt-2 pt-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="fw-semibold">Notes:</span>
          </div>
          {configOpen ? (
            <textarea
              className="form-control form-control-sm mt-1"
              rows={3}
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={commitNotes}
              placeholder="Loadout notes..."
            />
          ) : (
            <div className="text-muted small mt-1">
              {notes || "No notes yet."}
            </div>
          )}
        </div>

        {/* Delete button */}
        {configOpen && !isNpcMode && (
          <div className="mt-3 d-flex justify-content-end">
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={handleDeleteClick}
            >
              🗑 Delete Loadout
            </button>
          </div>
        )}

        {popupSection && (
          <LoadoutPopup
            section={popupSection}
            loadout={loadout}
            hpSources={hpSources}
            atkSources={atkSources}
            weaponSources={weaponSources}
            heSources={heSources}
            aeSources={aeSources}
            acSources={acSources}
            slotSources={slotSources}
            slotCardSources={slotCardSources}
            isNpcMode={isNpcMode}
            onClose={() => setPopupSection(null)}
            onSave={onUpdate}
          />
        )}
      </div>
    </div>
  );
}

export default LoadoutCard;