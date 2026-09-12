import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import './App.scss'
import ControlPanel from './Components/SideBar/SideBar.tsx'
import SectionNav from './Components/SectionNav.tsx'
import CharacterSheet from './Components/characters/CharacterSheet.tsx'
import { characterManager, isNpcCharacter } from './Components/characters/CharacterManager.tsx'
import type { Character } from './Components/characters/database/db.ts'
import { preloadMetadata, refreshMetadataIfChanged } from './services/enteMetadataService.ts'

function App({ discordId }: { discordId: string | null }) {
  const [characters, setCharacters] = useState<Character[]>([])
  const [activeCharacterId, setActiveCharacterId] = useState<number | null>(null)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [activeSection, setActiveSection] = useState<"loadout" | "entes" | "inventario">("entes")
  const [metadataVersion, setMetadataVersion] = useState(0)

  // Sidebar tab state (controlled from App)
  const [activeTabId, setActiveTabId] = useState<string>("main")

  // Track whether the section default has been applied for the first
  // character this session. After that, we preserve the user's choice
  // across character switches, only redirecting when the current section
  // is invalid for the new character.
  const sectionInitializedRef = useRef(false);

  useEffect(() => {
    refreshMetadataIfChanged()
      .then((changed) => {
        if (changed) setMetadataVersion((v) => v + 1);
      })
      .catch((err) => console.warn("Failed to refresh ente metadata:", err));
  }, []);

  useEffect(() => {
    if (activeCharacterId != null) {
      localStorage.setItem('lastActiveCharacterId', String(activeCharacterId));
    }
  }, [activeCharacterId]);

  const refreshCharacters = useCallback(async () => {
    if (!discordId) return;
    const chars = await characterManager.getCharactersByUser(discordId);
    chars.sort((a, b) => {
      const aIsExternal = a.source === "external" ? 1 : 0;
      const bIsExternal = b.source === "external" ? 1 : 0;
      return bIsExternal - aIsExternal || a.charName.localeCompare(b.charName);
    });
    setCharacters(chars);
  }, [discordId]);

  useEffect(() => {
    if (!discordId) return;

    async function init() {
      let chars = await characterManager.getCharactersByUser(discordId!);

      if (chars.length === 0) {
        const newId = await characterManager.createCharacter(discordId!, "Default Character");
        const newChar = await characterManager.getCharacter(newId);
        chars = [newChar!];
      }

      chars.sort((a, b) => {
        const aIsExternal = a.source === "external" ? 1 : 0;
        const bIsExternal = b.source === "external" ? 1 : 0;
        return bIsExternal - aIsExternal || a.charName.localeCompare(b.charName);
      });

      setCharacters(chars);

      const savedId = localStorage.getItem('lastActiveCharacterId');
      if (savedId) {
        const id = Number(savedId);
        if (chars.some(c => c.id === id)) {
          setActiveCharacterId(id);
          preloadMetadata();
          return;
        }
      }

      setActiveCharacterId(chars[0]?.id ?? null);
      preloadMetadata();
    }

    init();

    const handler = refreshCharacters;
    characterManager.on("characterCreated", handler);
    characterManager.on("characterDeleted", handler);
    characterManager.on("characterUpdated", handler);

    return () => {
      characterManager.off("characterCreated", handler);
      characterManager.off("characterDeleted", handler);
      characterManager.off("characterUpdated", handler);
    };
  }, [discordId, refreshCharacters]);

  const activeCharacter = useMemo(() => {
    if (!activeCharacterId) return null;
    return characters.find((c) => c.id === activeCharacterId) ?? null;
  }, [characters, activeCharacterId]);

  const activeIsNpc = activeCharacter ? isNpcCharacter(activeCharacter) : false;

  // Keep the sidebar tab in sync when the active character changes.
  useEffect(() => {
    if (!activeCharacter) return;

    let targetTab = "main";
    if (activeCharacter.isImportedShared) {
      targetTab = "shared";
    } else if (activeCharacter.tabId) {
      targetTab = activeCharacter.tabId;
    } else if (!activeCharacter.externalId) {
      targetTab = "npc";
    }

    setActiveTabId(targetTab);
  }, [activeCharacter]);


  useEffect(() => {
    if (!activeCharacter) return;

    if (!sectionInitializedRef.current) {
      sectionInitializedRef.current = true;
      setActiveSection(activeIsNpc ? "loadout" : "entes");
      return;
    }

    if (activeIsNpc) {
      setActiveSection((prev) => (prev === "inventario" ? "loadout" : prev));
    }
  }, [activeCharacter?.id, activeIsNpc]);

  const isNpcMode = activeIsNpc;

  return (
    <div className="container-fluid vh-100">
      <div className="row h-100">
        <div className={`sidebar g-0 ${sidebarHidden ? 'hidden' : ''}`}>
          <ControlPanel
            sidebarHidden={sidebarHidden}
            setSidebarHidden={setSidebarHidden}
            setCharacters={setCharacters}
            characters={characters}
            activeCharacterId={activeCharacterId}
            setActiveCharacterId={setActiveCharacterId}
            activeTabId={activeTabId}
            setActiveTabId={setActiveTabId}
          />
        </div>

        {!sidebarHidden && (
          <div
            className="sidebar-overlay"
            onClick={() => setSidebarHidden(true)}
          />
        )}

        <div className="col d-flex flex-column p-0">
          <div className="d-flex align-items-center">
            <div className="main">
              <div className='main-top'>
                <SectionNav
                  activeSection={activeSection}
                  setActiveSection={setActiveSection}
                  sidebarHidden={sidebarHidden}
                  onShowSidebar={() => setSidebarHidden(false)}
                  isNpcMode={isNpcMode}
                />
              </div>
              <div className="main-bottom">
                <CharacterSheet
                  activeSection={activeSection}
                  characterId={activeCharacterId}
                  metadataVersion={metadataVersion}
                  isNpcMode={isNpcMode}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export { App }