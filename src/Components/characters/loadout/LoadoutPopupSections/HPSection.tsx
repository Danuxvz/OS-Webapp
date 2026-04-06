import { useMemo, useState, useEffect } from "react";
import type { Loadout, LoadoutHpSource } from "../../../../types";

interface Props {
  loadout: Loadout;
  hpSources: LoadoutHpSource[];
  onSave: (loadout: Loadout) => void;
}

function HPSection({ loadout, hpSources, onSave }: Props) {
  const hp = loadout.data.hp ?? {
    baseMax: 0,
    baseCurrent: 0,
    tempBonus: 0,
    characterTempBonus: 0,
    sources: [],
    barriers: [],
  };

  // Local state for temp bonus (string during editing)
  const [localTempBonus, setLocalTempBonus] = useState(String(hp.tempBonus));
  // Local state for barrier amounts
  const [localBarrierAmounts, setLocalBarrierAmounts] = useState<Record<string, string>>(() => {
    const barriers = hp.barriers ?? [];
    const map: Record<string, string> = {};
    barriers.forEach((b) => {
      map[b.id] = String(b.amount);
    });
    return map;
  });

  // Sync when loadout changes
  useEffect(() => {
    setLocalTempBonus(String(hp.tempBonus));
    const barriers = hp.barriers ?? [];
    const newMap: Record<string, string> = {};
    barriers.forEach((b) => {
      newMap[b.id] = String(b.amount);
    });
    setLocalBarrierAmounts(newMap);
  }, [loadout.id, hp.tempBonus, hp.barriers]);

  const mergedHpSources = useMemo(() => {
    const savedMap = new Map((hp.sources ?? []).map((s) => [s.enteId, s]));
    const merged: LoadoutHpSource[] = [];

    const liveIds = new Set<string>();

    for (const live of hpSources) {
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

    for (const saved of hp.sources ?? []) {
      if (!liveIds.has(saved.enteId)) merged.push(saved);
    }

    return merged;
  }, [hp.sources, hpSources]);

  const saveHpSources = (nextSources: LoadoutHpSource[]) => {
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        hp: {
          ...hp,
          sources: nextSources,
        },
      },
    });
  };

  const toggleHpSource = (enteId: string) => {
    saveHpSources(
      mergedHpSources.map((item) =>
        item.enteId === enteId ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  // Barriers helpers
  const barriers = hp.barriers ?? [];

  const updateHp = (nextHp: typeof hp) => {
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        hp: nextHp,
      },
    });
  };

  const makeBarrierId = () =>
    (globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const addBarrier = () => {
    updateHp({
      ...hp,
      barriers: [
        ...barriers,
        {
          id: makeBarrierId(),
          amount: 0,
        },
      ],
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

  const commitTempBonus = () => {
    const num = Number(localTempBonus);
    if (!isNaN(num) && num !== hp.tempBonus) {
      updateHp({
        ...hp,
        tempBonus: num,
      });
    }
  };

  const handleBarrierLocalChange = (id: string, value: string) => {
    setLocalBarrierAmounts((prev) => ({ ...prev, [id]: value }));
  };

  const commitBarrier = (id: string) => {
    const raw = localBarrierAmounts[id];
    const num = Number(raw);
    if (!isNaN(num) && num !== barriers.find((b) => b.id === id)?.amount) {
      updateBarrier(id, num);
    }
  };

  return (
    <>
      <h3 className="h5 mb-3">Edit HP</h3>

      {/* Loadout Temp Bonus */}
      <div className="mb-3">
        <label className="form-label">Loadout Temp Bonus</label>
        <input
          className="form-control"
          type="text"
          value={localTempBonus}
          onChange={(e) => setLocalTempBonus(e.target.value)}
          onBlur={commitTempBonus}
        />
      </div>

      {/* Barriers management */}
      <div className="mb-3">
        <div className="d-flex align-items-center justify-content-between">
          <label className="form-label mb-0">Barreras</label>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={addBarrier}
          >
            + Añadir barrera
          </button>
        </div>
        {barriers.map((barrier) => (
          <div key={barrier.id} className="d-flex align-items-center gap-2 mt-2">
            <input
              className="form-control"
              type="text"
              value={localBarrierAmounts[barrier.id] ?? ""}
              onChange={(e) => handleBarrierLocalChange(barrier.id, e.target.value)}
              onBlur={() => commitBarrier(barrier.id)}
              placeholder="Cantidad"
            />
            <button
              className="btn btn-outline-danger btn-sm"
              onClick={() => deleteBarrier(barrier.id)}
              title="Eliminar barrera"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Ente selection grid */}
      <div className="mb-2">
        <div className="small text-muted mb-2">
          Click an HP bonus to toggle it on or off for this loadout.
        </div>

        <div className="hp-source-grid">
          {mergedHpSources.map((source) => (
            <div
              key={source.enteId}
              className={`hp-source-card ${source.enabled ? "active" : ""}`}
              onClick={() => toggleHpSource(source.enteId)}
            >
              <div className="hp-source-image-wrapper">
                {source.image ? (
                  <img src={source.image} alt={source.name} />
                ) : (
                  <div className="hp-source-placeholder">No img</div>
                )}
              </div>
              <div className="hp-source-text">
                +{source.bonus} HP
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default HPSection;