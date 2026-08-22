import { useState, useEffect } from "react";
import type { Loadout, LoadoutHeSource } from "../../../../types";

interface Props {
  loadout: Loadout;
  heSources: LoadoutHeSource[];
  isNpcMode?: boolean;
  onSave: (loadout: Loadout) => void;
}

interface CustomHE {
  id: string;
  name: string;
  text: string;
  image?: string;
}

function HESection({ loadout, heSources, isNpcMode = false, onSave }: Props) {
  const he = {
    max: loadout.data.habilidadesPasivas?.max ?? 2,
    selectedIds: loadout.data.habilidadesPasivas?.selectedIds ?? [],
  };

  const [customHE, setCustomHE] = useState<CustomHE[]>(
    (loadout.data as any).customHE ?? []
  );
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customText, setCustomText] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");

  // No cleanup needed – unsaved form state disappears when component unmounts.
  // This effect is intentionally empty to emphasize that we do NOT auto‑save.
  useEffect(() => {
    return () => {
      // Nothing to do. Discard any unsaved local state.
    };
  }, []);

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

  const addCustomHE = () => {
    if (!customName.trim()) return;

    const newCustom: CustomHE = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: customName.trim(),
      text: customText.trim(),
    };

    const next = [...customHE, newCustom];

    setCustomHE(next);
    setCustomName("");
    setCustomText("");
    setShowCustomForm(false);

    // ❌ Do NOT modify he.selectedIds – new custom HE is not automatically active.
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        customHE: next,
        // habilidadesPasivas remains unchanged
      },
    });
  };

  const startEditCustom = (c: CustomHE) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditText(c.text);
    setShowCustomForm(false);
  };

  const saveEditCustom = () => {
    if (!editingId) return;
    const next = customHE.map((c) =>
      c.id === editingId
        ? { ...c, name: editName.trim() || c.name, text: editText.trim() }
        : c
    );
    setCustomHE(next);
    setEditingId(null);
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        customHE: next,
      },
    });
  };

  const deleteCustomHE = () => {
    if (!editingId) return;

    const next = customHE.filter((c) => c.id !== editingId);
    const nextSelectedIds = he.selectedIds.filter((id) => id !== editingId);

    setCustomHE(next);
    setEditingId(null);
    setEditName("");
    setEditText("");

    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        customHE: next,
        habilidadesPasivas: {
          ...he,
          selectedIds: nextSelectedIds,
        },
      },
    });
  };

  const cancelEditCustom = () => {
    setEditingId(null);
  };

  const selectedCustom = customHE.filter((c) => he.selectedIds.includes(c.id));
  const allSelected = [
    ...selectedCustom.map((c) => ({
      enteId: c.id,
      firstLine: c.name,
      restLines: c.text,
      image: c.image || "",
    })),
    ...heSources
      .filter((s) => he.selectedIds.includes(s.enteId))
      .map((s) => ({
        enteId: s.enteId,
        firstLine: s.text.split("\n")[0],
        restLines: s.text.split("\n").slice(1).join("\n"),
        image: s.image,
      })),
  ];

  return (
    <>
      <h3 className="h5 mb-3">Habilidades Pasivas</h3>

      {allSelected.length > 0 && (
        <div className="mb-3">
          <div className="small text-muted mb-2">Seleccionados:</div>
          <div className="selected-he-list">
            {allSelected.map((s) => (
              <div key={s.enteId} className="he-selected-card d-flex gap-2 align-items-center mb-2">
                {s.image && (
                  <img
                    src={s.image}
                    alt={s.firstLine}
                    style={{ width: 40, height: 40, objectFit: "contain" }}
                  />
                )}
                <div>
                  <b>{s.firstLine}</b>
                  {s.restLines && <div className="small text-muted">{s.restLines}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isNpcMode && (
        <div className="mb-3">
          {editingId ? (
            <div className="mt-2">
              <input
                className="form-control mb-2"
                placeholder="Título"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <textarea
                className="form-control mb-2"
                placeholder="Descripción"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={saveEditCustom}>
                  Guardar
                </button>
                <button className="btn btn-sm btn-outline-secondary" onClick={cancelEditCustom}>
                  Cancelar
                </button>
                <button className="btn btn-sm btn-outline-danger" onClick={deleteCustomHE}>
                  Eliminar
                </button>
              </div>
            </div>
          ) : showCustomForm ? (
            <div className="mt-2">
              <input
                className="form-control mb-2"
                placeholder="Título"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
              <textarea
                className="form-control mb-2"
                placeholder="Descripción"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={addCustomHE}>
                  Add
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowCustomForm(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => setShowCustomForm(true)}
            >
              + Custom HE
            </button>
          )}
        </div>
      )}

      <div className="small text-muted mb-2">
        Click para seleccionar (sin límite)
      </div>

      <div className="he-grid">
        {customHE.map((c) => (
          <div
            key={c.id}
            className={`he-card ${he.selectedIds.includes(c.id) ? "active" : ""}`}
            onClick={() => toggleHe(c.id)}
          >
            <div className="he-text">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <b>{c.name}</b>
                  <div className="small">{c.text}</div>
                </div>
                <button
                  className="btn btn-link btn-sm p-0 ms-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditCustom(c);
                  }}
                  title="Editar"
                >
                  ⚙
                </button>
              </div>
            </div>
          </div>
        ))}

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