import type { Loadout, LoadoutHeSource } from "../../../../types";

interface Props {
  loadout: Loadout;
  heSources: LoadoutHeSource[];
  onSave: (loadout: Loadout) => void;
}

function HESection({ loadout, heSources, onSave }: Props) {
  const he = {
    max: loadout.data.habilidadesPasivas?.max ?? 2,
    selectedIds: loadout.data.habilidadesPasivas?.selectedIds ?? [],
  };

  const toggleHe = (enteId: string) => {
    let next = [...he.selectedIds];
    if (next.includes(enteId)) {
      next = next.filter((id) => id !== enteId);
    } else {
      next.push(enteId);
    }
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        habilidadesPasivas: {
          ...he,
          selectedIds: next,
        },
      },
    });
  };

  const selectedHE = heSources.filter((s) => he.selectedIds.includes(s.enteId));

  return (
    <>
      <h3 className="h5 mb-3">Habilidades Pasivas</h3>

      {selectedHE.length > 0 && (
        <div className="mb-3">
          <div className="small text-muted mb-2">Seleccionados:</div>
          <div className="selected-he-list">
            {selectedHE.map((s) => {
              const firstLine = s.text.split("\n")[0];
              const restLines = s.text.split("\n").slice(1).join("\n");
              return (
                <div key={s.enteId} className="he-selected-card d-flex gap-2 align-items-center mb-2">
                  {s.image && <img src={s.image} alt={firstLine} style={{ width: 40, height: 40, objectFit: "cover" }} />}
                  <div>
                    <b>{firstLine}</b>
                    {restLines && <div className="small text-muted">{restLines}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="small text-muted mb-2">
        Click para seleccionar (sin límite)
      </div>

      <div className="he-grid">
        {heSources.map((source) => {
          const firstLine = source.text.split("\n")[0];
          const restLines = source.text.split("\n").slice(1).join("\n");
          return (
            <div
              key={source.enteId}
              className={`he-card ${he.selectedIds.includes(source.enteId) ? "active" : ""}`}
              onClick={() => toggleHe(source.enteId)}
            >
              <div className="he-image-wrapper">
                {source.image ? (
                  <img src={source.image} alt={firstLine} />
                ) : (
                  <div className="he-placeholder">No img</div>
                )}
              </div>
              <div className="he-text">
                <b>{firstLine}</b>
                {restLines && <div className="small">{restLines}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default HESection;
