// CharacterDetails.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
import type { Character } from "../characters/database/db";
import { characterManager } from "../characters/CharacterManager";
import { deleteRemoteCharacter } from "../../services/Sync.tsx";

interface Props {
  character: Character;
  isActive: boolean;
  onSelect: () => void;
}

type StatKey = "hp" | "atk" | "slots";

const CharacterDetails = React.memo(function CharacterDetails({
  character,
  isActive,
  onSelect,
}: Props) {
  // -- local editing state (reset when character changes) --
  const [localChar, setLocalChar] = useState<Character>(character);
  const [nameDraft, setNameDraft] = useState(character.charName || "");
  const [openBreakdown, setOpenBreakdown] = useState<StatKey | null>(null);

  const updateTimerRef = useRef<number | null>(null);
  const nameDebounceRef = useRef<number | null>(null);
  const localCharRef = useRef<Character>(character);

  // Keep a ref to the latest localChar so event handler always sees current value
  useEffect(() => {
    localCharRef.current = localChar;
  }, [localChar]);

  // When the character prop changes, immediately update all local state
  useEffect(() => {
    setLocalChar(character);
    setNameDraft(character.charName || "");
    setOpenBreakdown(null);
  }, [character]);

  /* =========================
     EVENT LISTENER (only when active)
  ========================= */
  useEffect(() => {
    if (!isActive) return;

    let mounted = true;

    const handler = (_updatedChar: Character | any) => {
      if (!_updatedChar) return;

      const matches =
        _updatedChar.id === character.id ||
        _updatedChar.characterId === character.id;
      if (!matches) return;

      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }

      updateTimerRef.current = window.setTimeout(async () => {
        if (!mounted) return;

        try {
          const fresh = await characterManager.getCharacter(character.id!);
          if (!mounted || !fresh) return;

          // Only update if something actually changed
          const current = localCharRef.current;
          const isDifferent =
            fresh.updatedAt !== current.updatedAt ||
            JSON.stringify(fresh.bonusLog) !== JSON.stringify(current.bonusLog) ||
            fresh.tempStatBonus.hp !== current.tempStatBonus.hp ||
            fresh.tempStatBonus.atk !== current.tempStatBonus.atk ||
            fresh.tempStatBonus.slots !== current.tempStatBonus.slots ||
            fresh.charImage !== current.charImage ||
            fresh.charName !== current.charName;

          if (isDifferent) {
            setLocalChar(fresh);
          }
        } catch (error) {
          // ignore transient fetch errors
        } finally {
          updateTimerRef.current = null;
        }
      }, 250);
    };

    characterManager.on("characterUpdated", handler);
    characterManager.on("bonusUpdated", handler);

    return () => {
      mounted = false;
      characterManager.off("characterUpdated", handler);
      characterManager.off("bonusUpdated", handler);

      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }
    };
  }, [isActive, character.id]);

  /* =========================
     FIELD UPDATE
  ========================= */
  async function updateField(field: string, value: any) {
    const fresh = await characterManager.updateCharacter(character.id!, {
      [field]: value,
    });
    if (fresh) setLocalChar(fresh);
  }

  function updateNameDebounced(value: string) {
    setNameDraft(value);

    if (nameDebounceRef.current) {
      window.clearTimeout(nameDebounceRef.current);
      nameDebounceRef.current = null;
    }

    nameDebounceRef.current = window.setTimeout(async () => {
      const fresh = await characterManager.updateCharacter(character.id!, {
        charName: value,
      });
      if (fresh) setLocalChar(fresh);
    }, 500);
  }

  async function updateTempStat(stat: StatKey, value: number) {
    const updatedTemp = { ...localChar.tempStatBonus, [stat]: value };

    // Optimistic UI update
    setLocalChar({ ...localChar, tempStatBonus: updatedTemp });

    await characterManager.updateCharacter(character.id!, {
      tempStatBonus: updatedTemp,
    });
    await characterManager.recalculateCharacterBonuses(character.id!);

    // Fetch the final calculated state
    const fresh = await characterManager.getCharacter(character.id!);
    if (fresh) setLocalChar(fresh);
  }

  /* =========================
     BONUS SUM
  ========================= */
  function sumBonus(stat: StatKey) {
    return Object.values(localChar.bonusLog?.[stat] || {}).reduce(
      (a, b) => a + b,
      0
    );
  }

  const totalStats = useMemo(() => {
    return {
      hp: localChar.baseStats.hp + sumBonus("hp") + localChar.tempStatBonus.hp,
      atk: localChar.baseStats.atk + sumBonus("atk") + localChar.tempStatBonus.atk,
      slots: localChar.baseStats.slots + sumBonus("slots") + localChar.tempStatBonus.slots,
    };
  }, [localChar]);

  /* =========================
     Delete Character
  ========================= */
  async function handleDelete(e: MouseEvent) {
    e.stopPropagation();

    const confirmed = confirm(
      `Delete "${localChar.charName || "Unnamed Character"}"?`
    );
    if (!confirmed) return;

    if (nameDebounceRef.current) {
      window.clearTimeout(nameDebounceRef.current);
      nameDebounceRef.current = null;
    }

    await deleteRemoteCharacter(localChar.id!);
    await characterManager.deleteCharacter(character.id!);
  }

  /* =========================
     RENDER
  ========================= */
  return (
    <div className={`character-accordion ${isActive ? "active" : ""}`}>
      <div
        className={`character-header ${isActive ? "selected" : ""}`}
        onClick={onSelect}
      >
        <button className="delete-btn" onClick={handleDelete}>
          ✕
        </button>

        <span className="character-title">
          {localChar.charName || "Unnamed Character"}
        </span>

        <span className={`arrow ${isActive ? "open" : ""}`}>
          {isActive ? "▼" : "▲"}
        </span>
      </div>

      <div className={`character-body ${isActive ? "expanded" : ""}`}>
        <div
          className="character-image"
          onClick={() => {
            const url = prompt("Insert image URL:", localChar.charImage || "");
            if (url !== null) updateField("charImage", url);
          }}
        >
          {localChar.charImage ? (
            <img src={localChar.charImage} alt="Character" />
          ) : (
            <span>Click to insert image</span>
          )}
        </div>

        <input
          type="text"
          className="textInput"
          value={nameDraft}
          onChange={(e) => updateNameDebounced(e.target.value)}
          onBlur={() => {
            if (nameDebounceRef.current) {
              window.clearTimeout(nameDebounceRef.current);
              nameDebounceRef.current = null;
            }
            if (nameDraft !== localCharRef.current.charName) {
              updateField("charName", nameDraft);
            }
          }}
        />

        {(["hp", "atk", "slots"] as StatKey[]).map((stat) => (
          <div key={stat} className="stats">
            <p
              style={{ cursor: "pointer", fontWeight: 600 }}
              onClick={() =>
                setOpenBreakdown(openBreakdown === stat ? null : stat)
              }
            >
              {stat.toUpperCase()}:
            </p>

            <span>{totalStats[stat]}</span>

            <input
              type="number"
              className="numInput"
              value={localChar.tempStatBonus[stat] || ""}
              onChange={(e) =>
                updateTempStat(stat, Number(e.target.value) || 0)
              }
            />
          </div>
        ))}

        {openBreakdown && (
          <div className="stat-modal-overlay">
            <div className="stat-modal">
              <button
                className="close-btn"
                onClick={() => setOpenBreakdown(null)}
              >
                ✕
              </button>

              <h3>{openBreakdown.toUpperCase()} Breakdown</h3>

              <table>
                <thead>
                  <tr>
                    <th>EnteID</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(localChar.bonusLog?.[openBreakdown] || {}).map(
                    ([enteID, value]) => (
                      <tr key={enteID}>
                        <td>{enteID}</td>
                        <td>{value}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default CharacterDetails;