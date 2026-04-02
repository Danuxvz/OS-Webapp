import { useMemo } from "react";
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
  };

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

  return (
    <>
      <h3 className="h5 mb-3">Edit HP</h3>

      <div className="mb-3">
        <label className="form-label">Loadout Temp Bonus</label>
        <input
          className="form-control"
          type="number"
          value={hp.tempBonus}
          onChange={(e) =>
            onSave({
              ...loadout,
              data: {
                ...loadout.data,
                hp: {
                  ...hp,
                  tempBonus: Number(e.target.value),
                },
              },
            })
          }
        />
      </div>

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