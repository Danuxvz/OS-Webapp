import { useState, useEffect } from "react";
import type { Loadout, LoadoutACSource, ArmorType } from "../../../../types";

interface Props {
  loadout: Loadout;
  acSources: LoadoutACSource[];
  onSave: (loadout: Loadout) => void;
}

function ACSection({ loadout, acSources, onSave }: Props) {
  const armorClass = loadout.data.armorClass ?? {
    enteId: null,
    type: "Custom",
    name: "",
    bonus: 1,
    text: "",
    image: "",
  };

  const [localType, setLocalType] = useState(armorClass.type);
  const [localName, setLocalName] = useState(armorClass.name);
  const [localBonus, setLocalBonus] = useState(String(armorClass.bonus));
  const [localText, setLocalText] = useState(armorClass.text);

  useEffect(() => {
    setLocalType(armorClass.type);
    setLocalName(armorClass.name);
    setLocalBonus(String(armorClass.bonus));
    setLocalText(armorClass.text);
  }, [loadout.id, armorClass.type, armorClass.name, armorClass.bonus, armorClass.text]);

  const parseAcMeta = (raw: string | undefined): { type: ArmorType; name: string; bonus: number; text: string } => {
    const text = (raw ?? "").trim();
    if (!text) {
      return { type: "Custom", name: "", bonus: 1, text: "" };
    }

    const [firstLine, ...rest] = text.split(/\r?\n/);
    const effectText = rest.join("\n");
    const bonusMatch = firstLine.match(/\+(\d+)\s*$/);
    const bonus = bonusMatch ? Number(bonusMatch[1]) : 1;

    const titlePart = bonusMatch ? firstLine.slice(0, bonusMatch.index).trim() : firstLine.trim();
    const [firstWord, ...titleParts] = titlePart.split(/\s+/);

    const type = ["Lowgear", "Headgear", "Armor"].includes(firstWord)
      ? (firstWord as "Lowgear" | "Headgear" | "Armor")
      : "Custom";

    return {
      type,
      name: type === "Custom" ? titlePart : titleParts.join(" ").trim(),
      bonus,
      text: effectText,
    };
  };

  const selectedAc = armorClass.enteId
    ? acSources.find((s) => s.enteId === armorClass.enteId) || null
    : null;

  const applyAc = (source: LoadoutACSource) => {
    const parsed = parseAcMeta(source.text);
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        armorClass: {
          enteId: source.enteId,
          type: parsed.type,
          name: parsed.name,
          bonus: parsed.bonus,
          text: source.text,
          image: source.image || "",
        },
      },
    });
  };

  const clearAc = () => {
    onSave({
      ...loadout,
      data: {
        ...loadout.data,
        armorClass: {
          enteId: null,
          type: "Custom",
          name: "",
          bonus: 1,
          text: "",
          image: "",
        },
      },
    });
  };

  const commitType = () => {
    if (localType !== armorClass.type) {
      onSave({
        ...loadout,
        data: {
          ...loadout.data,
          armorClass: {
            ...armorClass,
            type: localType as ArmorType,
          },
        },
      });
    }
  };

  const commitName = () => {
    if (localName !== armorClass.name) {
      onSave({
        ...loadout,
        data: {
          ...loadout.data,
          armorClass: {
            ...armorClass,
            name: localName,
          },
        },
      });
    }
  };

  const commitBonus = () => {
    const num = Number(localBonus);
    if (!isNaN(num) && num !== armorClass.bonus) {
      onSave({
        ...loadout,
        data: {
          ...loadout.data,
          armorClass: {
            ...armorClass,
            bonus: num,
          },
        },
      });
    }
  };

  const commitText = () => {
    if (localText !== armorClass.text) {
      onSave({
        ...loadout,
        data: {
          ...loadout.data,
          armorClass: {
            ...armorClass,
            text: localText,
          },
        },
      });
    }
  };

  return (
    <>
      <h3 className="h5 mb-3">Armor Class</h3>

      <div className="mb-3">
        <div className="weapon-top-panel">
          <div className="weapon-preview">
            {armorClass.image || selectedAc?.image ? (
              <img src={armorClass.image || selectedAc?.image || ""} alt={armorClass.name || "AC"} />
            ) : (
              <div className="weapon-preview-empty">No image</div>
            )}
          </div>

          <div className="weapon-fields">
            <div className="mb-2">
              <label className="form-label">AC Type</label>
              <select
                className="form-select"
                value={localType}
                onChange={(e) => setLocalType(e.target.value as ArmorType)}
                onBlur={commitType}
              >
                <option value="Custom">Custom</option>
                <option value="Lowgear">Lowgear</option>
                <option value="Headgear">Headgear</option>
                <option value="Armor">Armor</option>
              </select>
            </div>

            <div className="mb-2">
              <label className="form-label">AC Name</label>
              <input
                className="form-control"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                onBlur={commitName}
              />
            </div>

            <div className="mb-2">
              <label className="form-label">AC Bonus</label>
              <input
                className="form-control"
                type="text"
                value={localBonus}
                onChange={(e) => setLocalBonus(e.target.value)}
                onBlur={commitBonus}
              />
            </div>

            <div className="mb-2">
              <label className="form-label">AC Text</label>
              <textarea
                className="form-control"
                rows={4}
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                onBlur={commitText}
              />
            </div>

            <button className="btn btn-outline-danger btn-sm" onClick={clearAc}>
              Remove AC
            </button>
          </div>
        </div>
      </div>

      <div className="small text-muted mb-2">
        Click one ente to equip it. Clicking the same one again restores the metadata default.
      </div>

      <div className="he-grid">
        {acSources.map((source) => {
          const active = armorClass.enteId === source.enteId;
          const parsed = parseAcMeta(source.text);

          return (
            <div
              key={source.enteId}
              className={`he-card ${active ? "active" : ""}`}
              onClick={() => {
                if (active) {
                  clearAc();
                } else {
                  applyAc(source);
                }
              }}
            >
              <div className="he-image-wrapper">
                {source.image ? (
                  <img src={source.image} alt={source.name} />
                ) : (
                  <div className="he-placeholder">No img</div>
                )}
              </div>

              <div className="he-text">
                <b>
                  {parsed.type} {parsed.name} +{parsed.bonus}
                </b>
                {parsed.text && <div className="small">{parsed.text}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default ACSection;