import React, { useState, useEffect, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
import type { Character, Tab } from "../characters/database/db";
import { characterManager } from "../characters/CharacterManager";
import { deleteRemoteCharacter } from "../../services/Sync.tsx";
import "../ComponentStyles/PublishToggle.scss";

interface Props {
  character: Character;
  isActive: boolean;
  onSelect: () => void;
  tabs?: Tab[];
  onMoveToTab?: (characterId: number, tabId: string | null) => void;
}

type StatKey = "hp" | "atk" | "slots";

const CharacterDetails = React.memo(function CharacterDetails({
  character,
  isActive,
  onSelect,
  tabs = [],
  onMoveToTab,
}: Props) {
  const [localChar, setLocalChar] = useState<Character>(character);
  const [nameDraft, setNameDraft] = useState(character.charName || "");
  const [openBreakdown, setOpenBreakdown] = useState<StatKey | null>(null);

  const updateTimerRef = useRef<number | null>(null);
  const nameDebounceRef = useRef<number | null>(null);
  const localCharRef = useRef<Character>(character);

  useEffect(() => {
    localCharRef.current = localChar;
  }, [localChar]);

  useEffect(() => {
    setLocalChar(character);
    setNameDraft(character.charName || "");
    setOpenBreakdown(null);
  }, [character.id, character.updatedAt, character.charName, character.charImage]);

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

    setLocalChar({ ...localChar, tempStatBonus: updatedTemp });

    await characterManager.updateCharacter(character.id!, {
      tempStatBonus: updatedTemp,
    });
    await characterManager.recalculateCharacterBonuses(character.id!);

    const fresh = await characterManager.getCharacter(character.id!);
    if (fresh) setLocalChar(fresh);
  }

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

  const isMainTab = Boolean(character.externalId && !character.tabId);

  const handleTabChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    // If value is "shared" we need to set isImportedShared = true and tabId = null
    // Otherwise, normal tab assignment.
    if (value === "shared") {
      if (onMoveToTab) {
        await onMoveToTab(character.id!, null);
      }
    } else {
      const newTabId = value === "main" || value === "npc" ? null : value;
      if (onMoveToTab) {
        await onMoveToTab(character.id!, newTabId);
      }
    }
  };

  const togglePublished = async (e: MouseEvent) => {
    e.stopPropagation();
    const fresh = await characterManager.setPublished(character.id!, !localChar.isPublished);
    if (fresh) setLocalChar(fresh);
  };

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

        {!isMainTab && (
          <div className="character-tab-select-row">
            <div className="character-tab-select">
              <label>Group:</label>
              <select
                value={
                  character.isImportedShared
                    ? "shared"
                    : character.tabId ?? (character.externalId ? "main" : "npc")
                }
                onChange={handleTabChange}
              >
                <option value="npc">NPC</option>
                {character.isImportedShared && <option value="shared">Shared</option>}
                {tabs.map(tab => (
                  <option key={tab.id} value={tab.id}>{tab.name}</option>
                ))}
              </select>
            </div>

            <button
              className={`publish-toggle-btn ${localChar.isPublished ? "published" : "private"}`}
              onClick={togglePublished}
              title={localChar.isPublished ? "Published — click to make private" : "Private — click to publish"}
            >
              {localChar.isPublished ? (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.53 13.53 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>
        )}

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