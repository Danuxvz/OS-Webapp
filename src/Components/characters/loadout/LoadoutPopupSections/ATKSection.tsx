import { useMemo, useState, useEffect } from "react";
import type { Loadout, LoadoutHpSource } from "../../../../types";

interface Props {
  loadout: Loadout;
  atkSources: LoadoutHpSource[];
  onSave: (loadout: Loadout) => void;
}

function ATKSection({ loadout, atkSources, onSave }: Props) {
  const atk = loadout.data.atk ?? {
    base: 0,
    tempBonus: 0,
    characterTempBonus: 0,
    sources: [],
  };

  const [localTempBonus, setLocalTempBonus] = useState(String(atk.tempBonus));

  useEffect(() => {
    setLocalTempBonus(String(atk.tempBonus));
  }, [loadout.id, atk.tempBonus]);

  const mergedAtkSources = useMemo(() => {
    const savedMap = new Map((atk.sources ?? []).map((s) => [s.enteId, s]));
    const merged: LoadoutHpSource[] = [];
    const liveIds = new Set<string>();

    for (const live of atkSources) {
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

    for (const saved of atk.sources ?? []) {
      if (!liveIds.has(saved.enteId)) merged.push(saved);
    }

    return merged;
  }, [atk.sources, atkSources]);

  const saveAtkSources = (nextSources: LoadoutHpSource[]) => {
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        atk: {
          ...atk,
          sources: nextSources,
        },
      },
    });
  };

  const toggleAtkSource = (enteId: string) => {
    saveAtkSources(
      mergedAtkSources.map((item) =>
        item.enteId === enteId ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const commitTempBonus = () => {
    const num = Number(localTempBonus);
    if (!isNaN(num) && num !== atk.tempBonus) {
      onSave({
        ...loadout,
        data: {
          ...loadout.data,
          atk: {
            ...atk,
            tempBonus: num,
          },
        },
      });
    }
  };

  return (
    <>
      <h3 className="h5 mb-3">Edit ATK</h3>

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

      <div className="mb-2">
        <div className="small text-muted mb-2">
          Click an ATK bonus to toggle it on or off for this loadout.
        </div>

        <div className="hp-source-grid">
          {mergedAtkSources.map((source) => (
            <div
              key={source.enteId}
              className={`hp-source-card ${source.enabled ? "active" : ""}`}
              onClick={() => toggleAtkSource(source.enteId)}
            >
              <div className="hp-source-image-wrapper">
                {source.image ? (
                  <img src={source.image} alt={source.name} />
                ) : (
                  <div className="hp-source-placeholder">No img</div>
                )}
              </div>
              <div className="hp-source-text">
                +{source.bonus} ATK
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default ATKSection;