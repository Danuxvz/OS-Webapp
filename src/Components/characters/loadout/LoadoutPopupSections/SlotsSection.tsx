import { useMemo, useState, useEffect } from "react";
import type { Loadout, LoadoutSlotSource } from "../../../../types";

interface Props {
  loadout: Loadout;
  slotSources: LoadoutSlotSource[];
  slotCardSources: { cardId: string; name: string; image?: string; amount: number }[];
  onSave: (loadout: Loadout) => void;
}

function SlotsSection({ loadout, slotSources, slotCardSources, onSave }: Props) {
  const slots = loadout.data.slots ?? {
    base: 0,
    tempBonus: 0,
    characterTempBonus: 0,
    sources: [],
    cards: [],
  };

  const [localTempBonus, setLocalTempBonus] = useState(String(slots.tempBonus));

  useEffect(() => {
    setLocalTempBonus(String(slots.tempBonus));
  }, [loadout.id, slots.tempBonus]);

  const enabledSlotBonus = (slots.sources ?? [])
    .filter((s) => s.enabled)
    .reduce((sum, s) => sum + (s.bonus || 0), 0);

  const totalSlots =
    (slots.base || 0) +
    (slots.characterTempBonus || 0) +
    (slots.tempBonus || 0) +
    enabledSlotBonus;

  const totalSelected = (slots.cards ?? []).reduce(
    (sum, c) => sum + c.quantity,
    0
  );

  const updateQuantity = (cardId: string, nextQtyRaw: number) => {
    const inventory = slotCardSources.find((c) => c.cardId === cardId);
    if (!inventory) return;

    const maxByInventory = inventory.amount;
    const currentQty = slots.cards?.find((c) => c.cardId === cardId)?.quantity ?? 0;

    const otherCardsTotal = totalSelected - currentQty;
    const maxBySlots = totalSlots - otherCardsTotal;

    const clamped = Math.max(0, Math.min(nextQtyRaw, maxByInventory, maxBySlots));

    const nextCards = [...(slots.cards ?? [])];
    const idx = nextCards.findIndex((c) => c.cardId === cardId);

    if (clamped === 0) {
      if (idx !== -1) nextCards.splice(idx, 1);
    } else {
      if (idx === -1) {
        nextCards.push({ cardId, quantity: clamped, usedIndices: [] });
      } else {
        const existing = nextCards[idx];
        const filteredUsed = (existing.usedIndices ?? []).filter(i => i < clamped);
        nextCards[idx] = {
          ...existing,
          quantity: clamped,
          usedIndices: filteredUsed,
        };
      }
    }

    onSave({
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

  const mergedSlotSources = useMemo(() => {
    const savedMap = new Map((slots.sources ?? []).map((s) => [s.enteId, s]));
    const merged: LoadoutSlotSource[] = [];
    const liveIds = new Set<string>();

    for (const live of slotSources) {
      const saved = savedMap.get(live.enteId);
      liveIds.add(live.enteId);

      merged.push({
        ...live,
        enabled: saved?.enabled ?? false,
        bonus: saved?.bonus ?? live.bonus,
        name: saved?.name ?? live.name,
        image: saved?.image ?? live.image,
      });
    }

    for (const saved of slots.sources ?? []) {
      if (!liveIds.has(saved.enteId)) merged.push(saved);
    }

    return merged;
  }, [slots.sources, slotSources]);

  const toggleSlotSource = (enteId: string) => {
    const nextSources = [...(slots.sources ?? [])];
    const idx = nextSources.findIndex((s) => s.enteId === enteId);

    if (idx === -1) {
      const source = slotSources.find((s) => s.enteId === enteId);
      if (source) {
        nextSources.push({ ...source, enabled: true });
      }
    } else {
      nextSources[idx] = {
        ...nextSources[idx],
        enabled: !nextSources[idx].enabled,
      };
    }

    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        slots: {
          ...slots,
          sources: nextSources,
        },
      },
    });
  };

  const commitTempBonus = () => {
    const num = Number(localTempBonus);
    if (!isNaN(num) && num !== slots.tempBonus) {
      onSave({
        ...loadout,
        data: {
          ...loadout.data,
          slots: {
            ...slots,
            tempBonus: num,
          },
        },
      });
    }
  };

  return (
    <>
      <h3 className="h5 mb-3">Slots</h3>

      {/* Card selector at the top */}
      <div className="small text-muted mb-2">Inventory cards</div>
      <div className="slot-inventory-grid mb-4">
        {slotCardSources.map((card) => {
          const selected = slots.cards?.find((c) => c.cardId === card.cardId);
          const qty = selected?.quantity ?? 0;

          return (
            <div key={card.cardId} className="slot-inventory-card">
              {card.image && (
                <img
                  src={card.image}
                  alt={card.name}
                  className="slot-card-img mb-2"
                />
              )}
              <div className="slot-inventory-title">{card.name}</div>
              <div className="slot-inventory-count">
                {qty} / {card.amount}
              </div>

              <div className="d-flex align-items-center gap-1 mt-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => updateQuantity(card.cardId, qty - 1)}
                >
                  -
                </button>

                <input
                  type="text"
                  className="form-control form-control-sm text-center"
                  style={{ width: "10%" }}
                  value={qty}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === "") {
                      updateQuantity(card.cardId, 0);
                      return;
                    }
                    const parsed = Number(raw);
                    if (Number.isNaN(parsed)) return;
                    updateQuantity(card.cardId, parsed);
                  }}
                />

                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => updateQuantity(card.cardId, qty + 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Temporary bonus input */}
      <div className="mt-3">
        <label className="form-label">Loadout Temp Bonus</label>
        <input
          className="form-control"
          type="text"
          value={localTempBonus}
          onChange={(e) => setLocalTempBonus(e.target.value)}
          onBlur={commitTempBonus}
        />
      </div>

      {/* Slot bonus section */}
      <div className="small text-muted mb-2">Slot bonus entes</div>
      <div className="hp-source-grid">
        {mergedSlotSources.map((source) => (
          <div
            key={source.enteId}
            className={`hp-source-card ${source.enabled ? "active" : ""}`}
            onClick={() => toggleSlotSource(source.enteId)}
          >
            <div className="hp-source-image-wrapper">
              {source.image ? (
                <img src={source.image} alt={source.name} />
              ) : (
                <div className="hp-source-placeholder">No img</div>
              )}
            </div>
            <div className="hp-source-text">+{source.bonus} Slots</div>
          </div>
        ))}
      </div>
    </>
  );
}

export default SlotsSection;