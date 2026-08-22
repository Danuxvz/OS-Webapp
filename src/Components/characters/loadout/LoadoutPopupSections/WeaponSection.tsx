import { useState, useEffect } from "react";
import type { Loadout, LoadoutWeaponSource } from "../../../../types";

interface Props {
  loadout: Loadout;
  weaponSources: LoadoutWeaponSource[];
  isNpcMode?: boolean;
  onSave: (loadout: Loadout) => void;
}

interface CustomWeapon {
  id: string;
  name: string;
  size: string;
  type: string;
  element: string;
  damageBonus: number;
  image?: string;
}

function WeaponSection({ loadout, weaponSources, isNpcMode = false, onSave }: Props) {
  const weapon = loadout.data.weapon ?? {
    enteId: null,
    name: "",
    size: "",
    type: "",
    element: "",
    damageBonus: 0,
    image: "",
  };

  // Local state for editable fields
  const [localName, setLocalName] = useState(weapon.name);
  const [localDamage, setLocalDamage] = useState(String(weapon.damageBonus));
  const [localSize, setLocalSize] = useState(weapon.size);
  const [localType, setLocalType] = useState(weapon.type);

  const [customWeapons, setCustomWeapons] = useState<CustomWeapon[]>(
    (loadout.data as any).customWeapons ?? []
  );
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSize, setCustomSize] = useState("");
  const [customType, setCustomType] = useState("");
  const [customElement, setCustomElement] = useState("");
  const [customDamage, setCustomDamage] = useState("0");

  // Editing state for custom weapons
  const [editingWeaponId, setEditingWeaponId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSize, setEditSize] = useState("");
  const [editType, setEditType] = useState("");
  const [editElement, setEditElement] = useState("");
  const [editDamage, setEditDamage] = useState("0");

  useEffect(() => {
    setLocalName(weapon.name);
    setLocalDamage(String(weapon.damageBonus));
    setLocalSize(weapon.size);
    setLocalType(weapon.type);
  }, [loadout.id, weapon.name, weapon.damageBonus, weapon.size, weapon.type]);

  const selectedWeapon = weapon.enteId
    ? weaponSources.find((w) => w.enteId === weapon.enteId) || null
    : null;

  const selectWeapon = (source: LoadoutWeaponSource | CustomWeapon) => {
    if ('enteId' in source) {
      onSave({
        ...loadout,
        data: {
          ...loadout.data,
          weapon: {
            ...weapon,
            enteId: source.enteId,
            image: source.image || "",
            element: source.element || "",
            name: weapon.name || source.name,
          },
        },
      });
    } else {
      onSave({
        ...loadout,
        data: {
          ...loadout.data,
          weapon: {
            enteId: null,
            name: source.name,
            size: source.size,
            type: source.type,
            element: source.element,
            damageBonus: source.damageBonus,
            image: source.image || "",
          },
        },
      });
    }
  };

  const clearWeapon = () => {
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        weapon: {
          enteId: null,
          name: "",
          size: "",
          type: "",
          element: "",
          damageBonus: 0,
          image: "",
        },
      },
    });
  };

  const addCustomWeapon = () => {
    if (!customName.trim()) return;
    const newCustom: CustomWeapon = {
      id: `custom_weapon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: customName.trim(),
      size: customSize,
      type: customType,
      element: customElement,
      damageBonus: Number(customDamage) || 0,
    };
    const next = [...customWeapons, newCustom];
    setCustomWeapons(next);
    setCustomName("");
    setCustomSize("");
    setCustomType("");
    setCustomElement("");
    setCustomDamage("0");
    setShowCustomForm(false);
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        customWeapons: next,
      },
    });
  };

  const startEditWeapon = (w: CustomWeapon) => {
    setEditingWeaponId(w.id);
    setEditName(w.name);
    setEditSize(w.size);
    setEditType(w.type);
    setEditElement(w.element);
    setEditDamage(String(w.damageBonus));
    setShowCustomForm(false);
  };

  const saveEditWeapon = () => {
    if (!editingWeaponId) return;

    const oldWeapon = customWeapons.find((w) => w.id === editingWeaponId);
    const updatedWeapon: CustomWeapon = {
      id: editingWeaponId,
      name: editName.trim() || oldWeapon?.name || "",
      size: editSize,
      type: editType,
      element: editElement,
      damageBonus: Number(editDamage) || 0,
      image: oldWeapon?.image,
    };

    const next = customWeapons.map((w) =>
      w.id === editingWeaponId ? updatedWeapon : w
    );

    // If the currently equipped weapon is the one being edited, update it too
    let newWeapon = weapon;
    if (
      weapon.enteId === null &&
      oldWeapon &&
      weapon.name === oldWeapon.name &&
      weapon.size === oldWeapon.size &&
      weapon.type === oldWeapon.type &&
      weapon.element === oldWeapon.element &&
      weapon.damageBonus === oldWeapon.damageBonus
    ) {
      newWeapon = {
        enteId: null,
        name: updatedWeapon.name,
        size: updatedWeapon.size,
        type: updatedWeapon.type,
        element: updatedWeapon.element,
        damageBonus: updatedWeapon.damageBonus,
        image: weapon.image,
      };
    }

    setCustomWeapons(next);
    setEditingWeaponId(null);
    setEditName("");
    setEditSize("");
    setEditType("");
    setEditElement("");
    setEditDamage("0");

    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        customWeapons: next,
        weapon: newWeapon,
      },
    });
  };

  const deleteCustomWeapon = () => {
    if (!editingWeaponId) return;

    const oldWeapon = customWeapons.find((w) => w.id === editingWeaponId);
    const next = customWeapons.filter((w) => w.id !== editingWeaponId);

    // If the equipped weapon is the one being deleted, clear it
    let newWeapon = weapon;
    if (
      weapon.enteId === null &&
      oldWeapon &&
      weapon.name === oldWeapon.name &&
      weapon.size === oldWeapon.size &&
      weapon.type === oldWeapon.type &&
      weapon.element === oldWeapon.element &&
      weapon.damageBonus === oldWeapon.damageBonus
    ) {
      newWeapon = {
        enteId: null,
        name: "",
        size: "",
        type: "",
        element: "",
        damageBonus: 0,
        image: "",
      };
    }

    setCustomWeapons(next);
    setEditingWeaponId(null);
    setEditName("");
    setEditSize("");
    setEditType("");
    setEditElement("");
    setEditDamage("0");

    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        customWeapons: next,
        weapon: newWeapon,
      },
    });
  };

  const commitName = () => { if (localName !== weapon.name) onSave({ ...loadout, data: { ...loadout.data, weapon: { ...weapon, name: localName } } }); };
  const commitDamage = () => { const num = Number(localDamage); if (!isNaN(num) && num !== weapon.damageBonus) onSave({ ...loadout, data: { ...loadout.data, weapon: { ...weapon, damageBonus: num } } }); };
  const commitSize = () => { if (localSize !== weapon.size) onSave({ ...loadout, data: { ...loadout.data, weapon: { ...weapon, size: localSize } } }); };
  const commitType = () => { if (localType !== weapon.type) onSave({ ...loadout, data: { ...loadout.data, weapon: { ...weapon, type: localType } } }); };

  return (
    <>
      <h3 className="h5 mb-3">Anrima</h3>

      {selectedWeapon ? (
        <div className="weapon-top-panel mb-3">
          <div className="weapon-preview">
            {weapon.image ? (
              <img src={weapon.image} alt={weapon.name || selectedWeapon.name} />
            ) : (
              <div className="weapon-preview-empty">No image</div>
            )}
          </div>

          <div className="weapon-fields">
            <div className="mb-2">
              <label className="form-label">Anrima Name</label>
              <input className="form-control" type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} onBlur={commitName} />
            </div>
            <div className="mb-2">
              <label className="form-label">Damage</label>
              <input className="form-control" type="text" value={localDamage} onChange={(e) => setLocalDamage(e.target.value)} onBlur={commitDamage} />
            </div>
            <div className="row g-2">
              <div className="col-6">
                <label className="form-label">Size</label>
                <select className="form-select" value={localSize} onChange={(e) => setLocalSize(e.target.value)} onBlur={commitSize}>
                  <option value="">Select</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Big">Big</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label">Type</label>
                <select className="form-select" value={localType} onChange={(e) => setLocalType(e.target.value)} onBlur={commitType}>
                  <option value="">Select</option>
                  <option value="Espadas">Espadas</option>
                  <option value="Lanzas">Lanzas</option>
                  <option value="Hachas">Hachas</option>
                  <option value="Guantes">Guantes</option>
                  <option value="Arcos">Arcos</option>
                  <option value="Armas de Fuego">Armas de Fuego</option>
                  <option value="Instrumentos">Instrumentos</option>
                  <option value="Libros">Libros</option>
                  <option value="Látigos">Látigos</option>
                  <option value="Escudos">Escudos</option>
                  <option value="Marionetas">Marionetas</option>
                </select>
              </div>
            </div>
            <div className="mt-2">
              <label className="form-label">Element</label>
              <input className="form-control" type="text" value={weapon.element || selectedWeapon.element || ""} readOnly />
            </div>
            <div className="mt-2">
              <button className="btn btn-outline-danger btn-sm" onClick={clearWeapon}>Remove Weapon</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-light border mb-3">Select a weapon from below.</div>
      )}

      {isNpcMode && (
        <div className="mb-3">
          {editingWeaponId ? (
            <div className="mt-2">
              <input className="form-control mb-2" placeholder="Nombre" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <input className="form-control mb-2" placeholder="Size" value={editSize} onChange={(e) => setEditSize(e.target.value)} />
              <input className="form-control mb-2" placeholder="Type" value={editType} onChange={(e) => setEditType(e.target.value)} />
              <input className="form-control mb-2" placeholder="Element" value={editElement} onChange={(e) => setEditElement(e.target.value)} />
              <input className="form-control mb-2" placeholder="Damage" type="text" value={editDamage} onChange={(e) => setEditDamage(e.target.value)} />
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={saveEditWeapon}>Guardar</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingWeaponId(null)}>Cancelar</button>
                <button className="btn btn-sm btn-outline-danger" onClick={deleteCustomWeapon}>Eliminar</button>
              </div>
            </div>
          ) : showCustomForm ? (
            <div className="mt-2">
              <input className="form-control mb-2" placeholder="Nombre" value={customName} onChange={(e) => setCustomName(e.target.value)} />
              <input className="form-control mb-2" placeholder="Size" value={customSize} onChange={(e) => setCustomSize(e.target.value)} />
              <input className="form-control mb-2" placeholder="Type" value={customType} onChange={(e) => setCustomType(e.target.value)} />
              <input className="form-control mb-2" placeholder="Element" value={customElement} onChange={(e) => setCustomElement(e.target.value)} />
              <input className="form-control mb-2" placeholder="Damage" type="text" value={customDamage} onChange={(e) => setCustomDamage(e.target.value)} />
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={addCustomWeapon}>Add</button>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowCustomForm(false)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-sm btn-outline-primary" onClick={() => setShowCustomForm(true)}>+ Custom Anrima</button>
          )}
        </div>
      )}

      <div className="small text-muted mb-2">Click one ente to equip it.</div>

      <div className="hp-source-grid">
        {customWeapons.map((w) => (
          <div
            key={w.id}
            className={`hp-source-card ${weapon.enteId === null && weapon.name === w.name ? "active" : ""}`}
            onClick={() => selectWeapon(w)}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div className="hp-source-text">{w.name}</div>
              <button
                className="btn btn-link btn-sm p-0 ms-2"
                onClick={(e) => {
                  e.stopPropagation();
                  startEditWeapon(w);
                }}
                title="Editar"
              >
                ⚙
              </button>
            </div>
          </div>
        ))}

        {weaponSources.map((source) => {
          const active = source.enteId === weapon.enteId;
          return (
            <div
              key={source.enteId}
              className={`hp-source-card ${active ? "active" : ""}`}
              onClick={() => {
                if (active) clearWeapon();
                else selectWeapon(source);
              }}
            >
              <div className="hp-source-image-wrapper">
                {source.image ? (
                  <img src={source.image} alt={source.name} />
                ) : (
                  <div className="hp-source-placeholder">No img</div>
                )}
              </div>
              <div className="hp-source-text">{source.name}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default WeaponSection;