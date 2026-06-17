// CharacterDetails.tsx
import { useState, useEffect, useMemo, useRef } from "react";
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

function CharacterDetails({ character, isActive, onSelect }: Props) {
  const [localChar, setLocalChar] = useState<Character>(character);
  const [openBreakdown, setOpenBreakdown] = useState<StatKey | null>(null);
  const [nameDraft, setNameDraft] = useState(character.charName || "");

  const updateTimerRef = useRef<number | null>(null);
  const nameDebounceRef = useRef<number | null>(null);
  const lastFetchIdRef = useRef(0);
  const localCharRef = useRef<Character>(character);

  useEffect(() => {
    localCharRef.current = localChar;
  }, [localChar]);

  // Refresh character data when becoming active
  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;
    const fetchData = async () => {
      const fresh = await characterManager.getCharacter(character.id!);
      if (!cancelled && fresh) {
        setLocalChar(fresh);
        setNameDraft(fresh.charName || "");
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [isActive, character.id]);

  /* =========================
     EVENT LISTENER (only when active)
  ========================= */
  useEffect(() => {
    if (!isActive) return;          // ← ignore events while collapsed

    let mounted = true;

    const handler = (updatedChar: Character | any) => {
      if (!updatedChar) return;

      const matches =
        updatedChar.id === character.id ||
        updatedChar.characterId === character.id;

      if (!matches) return;

      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }

      updateTimerRef.current = window.setTimeout(async () => {
        const fetchId = ++lastFetchIdRef.current;

        try {
          const fresh = await characterManager.getCharacter(character.id!);
          if (!mounted || fetchId !== lastFetchIdRef.current || !fresh) return;

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
          // ignore
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
  }, [isActive, character.id]);   // re‑subscribe when isActive changes

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

    // Update DB and recalculate bonuses
    await characterManager.updateCharacter(character.id!, {
      tempStatBonus: updatedTemp,
    });
    await characterManager.recalculateCharacterBonuses(character.id!);

    // Fetch the final state to be sure
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
      hp:
        localChar.baseStats.hp +
        sumBonus("hp") +
        localChar.tempStatBonus.hp,

      atk:
        localChar.baseStats.atk +
        sumBonus("atk") +
        localChar.tempStatBonus.atk,

      slots:
        localChar.baseStats.slots +
        sumBonus("slots") +
        localChar.tempStatBonus.slots,
    };
  }, [localChar]);

  /* =========================
     Delete Character
  ======================== */
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
     Sync draft name when character changes
  ========================= */
  useEffect(() => {
    setNameDraft(localChar.charName || "");
  }, [localChar.charName, localChar.id]);

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
}

export default CharacterDetails;