import type { Loadout, LoadoutWeaponSource } from "../../../../types";

interface Props {
  loadout: Loadout;
  weaponSources: LoadoutWeaponSource[];
  onSave: (loadout: Loadout) => void;
}

function WeaponSection({ loadout, weaponSources, onSave }: Props) {
  const weapon = loadout.data.weapon ?? {
    enteId: null,
    name: "",
    size: "",
    type: "",
    element: "",
    damageBonus: 0,
    image: "",
  };

  const selectedWeapon = weapon.enteId
    ? weaponSources.find((w) => w.enteId === weapon.enteId) || null
    : null;

  const selectWeapon = (source: LoadoutWeaponSource) => {
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
              <input
                className="form-control"
                type="text"
                value={weapon.name}
                onChange={(e) =>
                  onSave({
                    ...loadout,
                    data: {
                      ...loadout.data,
                      weapon: {
                        ...weapon,
                        name: e.target.value,
                      },
                    },
                  })
                }
              />
            </div>

            <div className="mb-2">
              <label className="form-label">Damage</label>
              <input
                className="form-control"
                type="text"
                inputMode="numeric"
                value={String(weapon.damageBonus ?? 0)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "");
                  onSave({
                    ...loadout,
                    data: {
                      ...loadout.data,
                      weapon: {
                        ...weapon,
                        damageBonus: digits === "" ? 0 : Number(digits),
                      },
                    },
                  });
                }}
              />
            </div>

            <div className="row g-2">
              <div className="col-6">
                <label className="form-label">Size</label>
                <select
                  className="form-select"
                  value={weapon.size}
                  onChange={(e) =>
                    onSave({
                      ...loadout,
                      data: {
                        ...loadout.data,
                        weapon: {
                          ...weapon,
                          size: e.target.value,
                        },
                      },
                    })
                  }
                >
                  <option value="">Select</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Big">Big</option>
                </select>
              </div>

              <div className="col-6">
                <label className="form-label">Type</label>
                <select
                  className="form-select"
                  value={weapon.type}
                  onChange={(e) =>
                    onSave({
                      ...loadout,
                      data: {
                        ...loadout.data,
                        weapon: {
                          ...weapon,
                          type: e.target.value,
                        },
                      },
                    })
                  }
                >
                  <option value="">Select</option>
                  <option value="Espadas">Espadas</option>
                  <option value="Lanzas">Lanzas</option>
                  <option value="Hachas">Hachas</option>
                  <option value="Guantes">Guantes</option>
                  <option value="Arcos">Arcos</option>
                  <option value="Armas de Fuego">Armas de Fuego</option>
                  <option value="Instrumentos">Instrumentos</option>
                  <option value="Libros">Libros</option>
                </select>
              </div>
            </div>

            <div className="mt-2">
              <label className="form-label">Element</label>
              <input
                className="form-control"
                type="text"
                value={weapon.element || selectedWeapon.element || ""}
                readOnly
              />
            </div>

            <div className="mt-2">
              <button className="btn btn-outline-danger btn-sm" onClick={clearWeapon}>
                Remove Weapon
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-light border mb-3">
          Select a weapon from below.
        </div>
      )}

      <div className="small text-muted mb-2">
        Click one ente to equip it. Clicking another replaces it.
      </div>

      <div className="hp-source-grid">
        {weaponSources.map((source) => {
          const active = source.enteId === weapon.enteId;
          return (
            <div
              key={source.enteId}
              className={`hp-source-card ${active ? "active" : ""}`}
              onClick={() => {
                if (active) {
                  clearWeapon();
                } else {
                  selectWeapon(source);
                }
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