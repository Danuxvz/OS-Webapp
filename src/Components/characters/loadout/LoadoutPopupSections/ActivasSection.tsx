import { useState } from "react";
import type { Loadout, LoadoutHeSource } from "../../../../types";

interface ActiveSkill {
  id: string;
  name: string;
  text: string;
}

interface Props {
  loadout: Loadout;
  aeSources: LoadoutHeSource[];
  isNpcMode?: boolean;
  onSave: (loadout: Loadout) => void;
}

function ActivasSection({ loadout, aeSources, isNpcMode = false, onSave }: Props) {
  // Custom activas storage
  const [activas, setActivas] = useState<ActiveSkill[]>(
    (loadout.data as any).habilidadesActivas ?? []
  );

  // Selected custom activa IDs (separate from storage)
  const selectedActivaIds = loadout.data.selectedActivaIds ?? [];

  // AE selection
  const activeAEIds = loadout.data.activeAEIds ?? [];

  // Form state for creating new custom activa
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customText, setCustomText] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");

  // ---------------------------------------------------------------
  // Custom activa selection
  // ---------------------------------------------------------------
  const toggleCustomActiva = (id: string) => {
    let next = [...selectedActivaIds];
    if (next.includes(id)) {
      next = next.filter((x) => x !== id);
    } else {
      next.push(id);
    }
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        selectedActivaIds: next,
      },
    });
  };

  // ---------------------------------------------------------------
  // AE selection
  // ---------------------------------------------------------------
  const toggleAE = (enteId: string) => {
    let next = [...activeAEIds];
    if (next.includes(enteId)) {
      next = next.filter((id) => id !== enteId);
    } else {
      next.push(enteId);
    }
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        activeAEIds: next,
      },
    });
  };

  // ---------------------------------------------------------------
  // Custom activa CRUD
  // ---------------------------------------------------------------
  const addCustomActive = () => {
    if (!customName.trim()) return;
    const newActive: ActiveSkill = {
      id: `active_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: customName.trim(),
      text: customText.trim(),
    };
    const next = [...activas, newActive];
    setActivas(next);
    setCustomName("");
    setCustomText("");
    setShowCustomForm(false);

    // ❌ Do NOT add to selectedActivaIds – user must select manually.
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        habilidadesActivas: next,
        selectedActivaIds,   // unchanged
      },
    });
  };

  const startEditCustom = (a: ActiveSkill) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditText(a.text);
    setShowCustomForm(false);
  };

  const saveEditCustom = () => {
    if (!editingId) return;
    const next = activas.map((a) =>
      a.id === editingId
        ? { ...a, name: editName.trim() || a.name, text: editText.trim() }
        : a
    );
    setActivas(next);
    setEditingId(null);
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        habilidadesActivas: next,
      },
    });
  };

  const deleteCustomActive = () => {
    if (!editingId) return;
    const next = activas.filter((a) => a.id !== editingId);
    const nextSelected = selectedActivaIds.filter((id) => id !== editingId);

    setActivas(next);
    setEditingId(null);
    setEditName("");
    setEditText("");
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        habilidadesActivas: next,
        selectedActivaIds: nextSelected,
      },
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  // ---------------------------------------------------------------
  // Build selected lists for display
  // ---------------------------------------------------------------
  const selectedCustom = activas
    .filter((a) => selectedActivaIds.includes(a.id))
    .map((a) => ({
      id: a.id,
      name: a.name,
      restText: a.text,
      image: "",
      isCustom: true as const,
    }));

  const selectedAE = aeSources
    .filter((s) => activeAEIds.includes(s.enteId))
    .map((s) => ({
      id: s.enteId,
      name: s.text.split("\n")[0] || s.name,
      restText: s.text.split("\n").slice(1).join("\n"),
      image: s.image || "",
      isCustom: false as const,
    }));

  const allSelected = [...selectedCustom, ...selectedAE];

  return (
    <>
      <h3 className="h5 mb-3">Habilidades Activas</h3>

      {allSelected.length > 0 && (
        <div className="mb-3">
          <div className="small text-muted mb-2">Seleccionadas:</div>
          <div className="selected-activas-list">
            {allSelected.map((s) => (
              <div key={s.id} className="he-selected-card d-flex gap-2 align-items-center mb-2">
                {s.image ? (
                  <img
                    src={s.image}
                    alt={s.name}
                    style={{ width: 40, height: 40, objectFit: "contain" }}
                  />
                ) : null}
                <div className="flex-grow-1">
                  <b>{s.name}</b>
                  {s.restText && <div className="small text-muted">{s.restText}</div>}
                </div>
                {s.isCustom && (
                  <button
                    className="btn btn-link btn-sm p-0 ms-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      const original = activas.find((a) => a.id === s.id);
                      if (original) startEditCustom(original);
                    }}
                    title="Editar"
                  >
                    ⚙
                  </button>
                )}
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
                <button className="btn btn-sm btn-outline-secondary" onClick={cancelEdit}>
                  Cancelar
                </button>
                <button className="btn btn-sm btn-outline-danger" onClick={deleteCustomActive}>
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
                <button className="btn btn-sm btn-primary" onClick={addCustomActive}>
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
              + Custom Activa
            </button>
          )}
        </div>
      )}

      <div className="small text-muted mb-2">
        Click para seleccionar AE
      </div>

      <div className="he-grid">
        {/* Custom activas as selectable cards */}
        {activas.map((a) => (
          <div
            key={a.id}
            className={`he-card ${selectedActivaIds.includes(a.id) ? "active" : ""}`}
            onClick={() => toggleCustomActiva(a.id)}
          >
            <div className="he-text">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <b>{a.name}</b>
                  <div className="small">{a.text}</div>
                </div>
                <button
                  className="btn btn-link btn-sm p-0 ms-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditCustom(a);
                  }}
                  title="Editar"
                >
                  ⚙
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* AE cards */}
        {aeSources.map((source) => {
          const firstLine = source.text.split("\n")[0];
          const restLines = source.text.split("\n").slice(1).join("\n");
          const isActive = activeAEIds.includes(source.enteId);

          return (
            <div
              key={source.enteId}
              className={`he-card ${isActive ? "active" : ""}`}
              onClick={() => toggleAE(source.enteId)}
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

export default ActivasSection;