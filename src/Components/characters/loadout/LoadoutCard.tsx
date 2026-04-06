import type {
  Loadout,
  LoadoutHpSource,
  LoadoutWeaponSource,
  LoadoutHeSource,
  LoadoutACSource,
  LoadoutSlotSource,
} from "../../../types";
import { useState, useEffect } from "react";
import LoadoutPopup from "./LoadoutPopup";

interface Props {
  loadout: Loadout;
  hpSources: LoadoutHpSource[];
  atkSources: LoadoutHpSource[];
  weaponSources: LoadoutWeaponSource[];
  heSources: LoadoutHeSource[];
  acSources: LoadoutACSource[];
  slotSources: LoadoutSlotSource[];
  slotCardSources: { cardId: string; name: string; image?: string; amount: number }[];
  onUpdate: (loadout: Loadout) => void;
  onDelete: (loadout: Loadout) => void;
}

function LoadoutCard({
  loadout,
  hpSources,
  atkSources,
  weaponSources,
  heSources,
  acSources,
  slotSources,
  slotCardSources,
  onUpdate,
  onDelete,
}: Props) {
  const [popupSection, setPopupSection] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  // Local state for editable fields to prevent cursor jumps
  const [localName, setLocalName] = useState(loadout.name);
  const [localHpCurrent, setLocalHpCurrent] = useState(
    String(loadout.data.hp?.baseCurrent ?? 0)
  );
  const [localBarrierAmounts, setLocalBarrierAmounts] = useState<
    Record<string, string>
  >(() => {
    const barriers = loadout.data.hp?.barriers ?? [];
    const map: Record<string, string> = {};
    barriers.forEach((b) => {
      map[b.id] = String(b.amount);
    });
    return map;
  });
  const [localNotes, setLocalNotes] = useState(loadout.data.notes ?? "");

  // Sync local state only when switching to a different loadout (not on every render)
  useEffect(() => {
    setLocalName(loadout.name);
    setLocalHpCurrent(String(loadout.data.hp?.baseCurrent ?? 0));
    setLocalNotes(loadout.data.notes ?? "");
    const barriers = loadout.data.hp?.barriers ?? [];
    const newMap: Record<string, string> = {};
    barriers.forEach((b) => {
      newMap[b.id] = String(b.amount);
    });
    setLocalBarrierAmounts(newMap);
  }, [loadout.id]);

  const hp = loadout.data.hp ?? {
    baseMax: 0,
    baseCurrent: 0,
    tempBonus: 0,
    characterTempBonus: 0,
    sources: [],
    barriers: [],
  };
  const atk = loadout.data.atk ?? {
    base: 0,
    tempBonus: 0,
    characterTempBonus: 0,
    sources: [],
  };
  const weapon = loadout.data.weapon ?? {
    enteId: null,
    name: "",
    size: "",
    type: "",
    element: "",
    damageBonus: 0,
    image: "",
  };

  const he = {
    max: loadout.data.habilidadesPasivas?.max ?? 2,
    selectedIds: loadout.data.habilidadesPasivas?.selectedIds ?? [],
  };

  const armorClass = loadout.data.armorClass ?? {
    enteId: null,
    type: "Custom",
    name: "",
    bonus: 1,
    text: "",
    image: "",
  };

  const slots = loadout.data.slots ?? {
    base: 0,
    tempBonus: 0,
    characterTempBonus: 0,
    sources: [],
    cards: [],
  };
  const notes = loadout.data.notes ?? "";

  const enabledHpBonus = (hp.sources ?? [])
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.bonus || 0), 0);

  const totalHP =
    (hp.baseMax || 0) +
    (hp.characterTempBonus || 0) +
    (hp.tempBonus || 0) +
    enabledHpBonus;

  const enabledAtkBonus = (atk.sources ?? [])
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.bonus || 0), 0);

  const totalATK =
    (atk.base || 0) +
    (atk.characterTempBonus || 0) +
    (atk.tempBonus || 0) +
    enabledAtkBonus;

  const hpPercent = totalHP > 0 ? ((hp.baseCurrent || 0) / totalHP) * 100 : 0;

  const weaponDetails = [weapon.size, weapon.element].filter(Boolean).join(" · ");

  const selectedHE = heSources
    .filter((s) => he.selectedIds.includes(s.enteId))
    .map((s) => ({
      ...s,
      firstLine: s.text.split("\n")[0],
      restLines: s.text.split("\n").slice(1).join("\n"),
    }));

  const acLines = (armorClass.text || "").split("\n");
  const acTitleLine = acLines[0] || "";
  const acEffectText = acLines.slice(1).join("\n");
  const acDisplay = armorClass.type === "Custom" && !armorClass.name
    ? "None"
    : `${armorClass.type} ${armorClass.name} +${armorClass.bonus}`;

  const enabledSlotBonus = (slots.sources ?? [])
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.bonus || 0), 0);

  const totalSlots =
    (slots.base || 0) +
    (slots.characterTempBonus || 0) +
    (slots.tempBonus || 0) +
    enabledSlotBonus;

  const slotBoxItems = (slots.cards ?? []).flatMap((card) =>
    Array.from({ length: card.quantity }, (_, index) => ({
      cardId: card.cardId,
      index,
      used: (card.usedIndices ?? []).includes(index),
    }))
  );

  const usedSlots = slotBoxItems.filter((item) => item.used).length;

  const handleToggleSlot = (cardId: string, index: number) => {
    const nextCards = [...(slots.cards ?? [])];
    const card = nextCards.find((c) => c.cardId === cardId);
    if (!card) return;

    const usedSet = new Set(card.usedIndices ?? []);
    const totalUsed = nextCards.reduce(
      (sum, c) => sum + (c.usedIndices ?? []).length,
      0
    );

    if (usedSet.has(index)) {
      usedSet.delete(index);
    } else {
      if (totalUsed >= totalSlots) return;
      usedSet.add(index);
    }

    card.usedIndices = Array.from(usedSet).sort((a, b) => a - b);

    onUpdate({
      ...loadout,
      data: {
        ...loadout.data,
        slots: {
          ...slots,
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

  // ---------- Barriers helpers ----------
  const barriers = hp.barriers ?? [];

  const updateHp = (nextHp: typeof hp) => {
    onUpdate({
      ...loadout,
      data: {
        ...loadout.data,
        hp: nextHp,
      },
    });
  };

  const updateBarrier = (id: string, amount: number) => {
    updateHp({
      ...hp,
      barriers: barriers.map((b) =>
        b.id === id ? { ...b, amount: Math.max(0, amount) } : b
      ),
    });
  };

  const deleteBarrier = (id: string) => {
    updateHp({
      ...hp,
      barriers: barriers.filter((b) => b.id !== id),
    });
  };

  const commitName = () => {
    if (localName !== loadout.name) {
      onUpdate({
        ...loadout,
        name: localName,
      });
    }
  };

  const commitHpCurrent = () => {
    const num = Number(localHpCurrent);
    if (!isNaN(num) && num !== hp.baseCurrent) {
      updateHp({
        ...hp,
        baseCurrent: num,
      });
    }
  };

  const commitBarrier = (id: string) => {
    const raw = localBarrierAmounts[id];
    const num = Number(raw);
    if (!isNaN(num) && num !== barriers.find((b) => b.id === id)?.amount) {
      updateBarrier(id, num);
    }
  };

  const commitNotes = () => {
    if (localNotes !== notes) {
      onUpdate({
        ...loadout,
        data: {
          ...loadout.data,
          notes: localNotes,
        },
      });
    }
  };

  const handleBarrierLocalChange = (id: string, value: string) => {
    setLocalBarrierAmounts((prev) => ({ ...prev, [id]: value }));
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
              />
            ) : (
              <h3 className="h5 mb-1">{loadout.name}</h3>
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
          {/* Red HP bar */}
          <div className="progress mb-2" style={{ height: "0.7rem" }}>
            <div
              className="progress-bar"
              style={{ width: `${Math.max(0, Math.min(hpPercent, 100))}%` }}
            />
          </div>

          {/* Blue barrier bars */}
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

          {/* HP current/max row + barrier inputs inline */}
          <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
            <span className="fw-semibold">HP:</span>
            <input
              className="form-control form-control-sm"
              style={{ maxWidth: "7rem" }}
              value={localHpCurrent}
              onChange={(e) => setLocalHpCurrent(e.target.value)}
              onBlur={commitHpCurrent}
            />
            <span className="text-muted">/ {totalHP}</span>

            {/* Config button for HP popup */}
            {configOpen && (
              <button
                className="btn btn-link btn-sm p-0"
                onClick={() => setPopupSection("hp")}
              >
                ⚙
              </button>
            )}

            {/* Barrier amount inputs (always visible) */}
            {barriers.map((barrier) => (
              <div key={barrier.id} className="d-flex align-items-center gap-1">
                <input
                  className="form-control form-control-sm ms-4"
                  style={{ maxWidth: "3rem" }}
                  type="text"
                  value={localBarrierAmounts[barrier.id] ?? ""}
                  onChange={(e) => handleBarrierLocalChange(barrier.id, e.target.value)}
                  onBlur={() => commitBarrier(barrier.id)}
                />
                {/* Delete button only in config mode */}
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
            <span className="fw-semibold">Habilidades Pasivas:</span>
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

        {/* AC Display with effect */}
        <div className="mb-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="fw-semibold">Armor Class:</span>
            <span>{acDisplay}</span>
            {configOpen && (
              <button
                className="btn btn-link btn-sm p-0"
                onClick={() => setPopupSection("ac")}
              >
                ⚙
              </button>
            )}
          </div>

          {armorClass.text && (
            <div className="small text-muted mt-1">
              {acEffectText || acTitleLine}
            </div>
          )}
        </div>

        {/* Slots display */}
        <div className="mb-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="fw-semibold">Slots:</span>
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
              {slotBoxItems.map((item) => {
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

        {/* Delete button (only in config mode) */}
        {configOpen && (
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
            acSources={acSources}
            slotSources={slotSources}
            slotCardSources={slotCardSources}
            onClose={() => setPopupSection(null)}
            onSave={onUpdate}
          />
        )}
      </div>
    </div>
  );
}

export default LoadoutCard;