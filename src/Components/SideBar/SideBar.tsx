import { useState, useEffect, useMemo, useRef } from "react";
import type { Character, Tab } from '../characters/database/db';
import CharacterDetails from "./CharacterDetails.tsx";
import PromptModal from "./PromptModal.tsx";
import ConfirmModal from "./ConfirmModal.tsx";
import BrowseNpcsPopup from "./BrowseNPCsPopup.tsx";
import { refreshMetadata } from '../../services/enteMetadataService.ts';
import { characterManager } from '../characters/CharacterManager';
import { getLoggedInDiscordUser, logout } from '../../services/SupaBase.ts';
import { syncAll } from '../../services/Sync.tsx';
import '../ComponentStyles/SideBar.scss';
import '../ComponentStyles/SharedTab.scss';

interface DiscordUser {
  id: string;
  username: string;
  avatarUrl: string;
}

interface SidebarProps {
  sidebarHidden: boolean;
  setSidebarHidden: React.Dispatch<React.SetStateAction<boolean>>;
  characters: Character[];
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  activeCharacterId: number | null;
  setActiveCharacterId: React.Dispatch<React.SetStateAction<number | null>>;
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
}

function ControlPanel({
  sidebarHidden,
  setSidebarHidden,
  characters,
  setCharacters,
  activeCharacterId,
  setActiveCharacterId,
  activeTabId,
  setActiveTabId,
}: SidebarProps) {

  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);

  const sortedTabs = useMemo(
    () => [...tabs].sort((a, b) => a.order - b.order),
    [tabs]
  );

  const [promptState, setPromptState] = useState<{ title: string; placeholder?: string } | null>(null);
  const promptResolveRef = useRef<((value: string | null) => void) | null>(null);

  const [confirmState, setConfirmState] = useState<{ message: string } | null>(null);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  function showPrompt(title: string, placeholder?: string): Promise<string | null> {
    return new Promise((resolve) => {
      promptResolveRef.current = resolve;
      setPromptState({ title, placeholder });
    });
  }

  function showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({ message });
    });
  }

  useEffect(() => {
    async function fetchUser() {
      const user = await getLoggedInDiscordUser();
      setDiscordUser(user);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function loadTabs() {
      const custom = await characterManager.getTabs();
      setTabs(custom);
    }
    loadTabs();
  }, []);

  const [showBrowseNpcs, setShowBrowseNpcs] = useState(false);

  const filteredCharacters = useMemo(() => {
    if (activeTabId === "main") {
      return characters.filter(c => !!c.externalId && !c.tabId);
    }
    if (activeTabId === "npc") {
      return characters.filter(c => !c.externalId && !c.tabId && !c.isImportedShared);
    }
    if (activeTabId === "shared") {
      return characters.filter(c => !!c.isImportedShared);
    }
    return characters.filter(c => c.tabId === activeTabId);
  }, [characters, activeTabId]);

  const handleAddTab = async () => {
    const name = await showPrompt("Nombre de la nueva pestaña:", "Ej: Villanos");
    if (!name?.trim()) return;
    const newId = await characterManager.createTab(name.trim());
    const nextOrder = tabs.length ? Math.max(...tabs.map((t) => t.order)) + 1 : 0;
    setTabs(prev => [...prev, { id: newId, name: name.trim(), order: nextOrder }]);
    setActiveTabId(newId);
  };

  const handleDeleteTab = async (tabId: string) => {
    const confirmed = await showConfirm("Eliminar pestaña y mover personajes a NPC?");
    if (!confirmed) return;
    await characterManager.deleteTab(tabId);
    setTabs(prev => prev.filter(t => t.id !== tabId));
    setActiveTabId("npc");
    const updated = await characterManager.getCharactersByUser(discordUser?.id ?? "");
    setCharacters(updated);
  };

  const selectCharacter = (id: number) => {
    if (id === activeCharacterId) return;
    setActiveCharacterId(id);
  };

  const handleMoveCharacter = async (characterId: number, newTabId: string | null) => {
    await characterManager.updateCharacterTab(characterId, newTabId);
    setCharacters(prev => prev.map(c =>
      c.id === characterId ? { ...c, tabId: newTabId ?? undefined, isImportedShared: false } : c
    ));
  };

  const refreshCharacterList = async () => {
    const updated = await characterManager.getCharactersByUser(discordUser?.id ?? "");
    setCharacters(updated);
  };

  const handleAddCharacter = async () => {
    const name = "New Character";
    const newCharId = await characterManager.createCharacter(discordUser?.id ?? "", name);

    if (activeTabId !== "main" && activeTabId !== "npc" && activeTabId !== "shared") {
      await characterManager.updateCharacterTab(newCharId, activeTabId);
    }

    const updatedChars = await characterManager.getCharactersByUser(discordUser?.id ?? "");
    updatedChars.sort((a, b) => {
      const aIsExternal = a.source === "external" ? 1 : 0;
      const bIsExternal = b.source === "external" ? 1 : 0;
      return bIsExternal - aIsExternal || a.charName.localeCompare(b.charName);
    });
    setCharacters(updatedChars);
    selectCharacter(newCharId);
  };

  useEffect(() => {
    function handleDeleted(id: number) {
      setCharacters(prev => prev.filter(c => c.id !== id));
      setActiveCharacterId(prev => prev === id ? null : prev);
    }
    characterManager.on("characterDeleted", handleDeleted);
    return () => {
      characterManager.off("characterDeleted", handleDeleted);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setDiscordUser(null);
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const handleDiscordSync = async () => {
    setIsSyncing(true);
    await refreshMetadata();
    setTimeout(() => setIsSyncing(false), 800);
  };

  return (
    <>
      {/* TOP BAR */}
      <div className="sidebar-top d-flex align-items-center">
        {discordUser ? (
          <img
            src={discordUser.avatarUrl}
            alt={discordUser.username}
            className="sidebar-btn discord-avatar rounded-circle"
            width={40}
            height={40}
            style={{ cursor: "pointer" }}
            onClick={() => {
              if (confirm("Log out of Discord?")) handleLogout();
            }}
          />
        ) : (
          <div style={{ width: 40, height: 40 }} />
        )}

        <button
          id="discordSyncBtn"
          className={`${isSyncing ? "spin" : ""}`}
          title="Sync inventory with Discord"
          onClick={async () => {
            await refreshMetadata();
            handleDiscordSync();
            await syncAll();
            console.log("Metadata refreshed from Google Sheets");
          }}
        >
          <svg id="discordSyncIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
            fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.418A6 6 0 1 1 8 2v1z" />
            <path d="M8 0v4l3-3-3-3z" />
          </svg>
        </button>

        <div id="toggleSidebar" className="d-flex align-items-center ms-2">
          <button className="btn btn-sm btn-outline-dark me-2 burger-btn"
            onClick={() => setSidebarHidden(!sidebarHidden)}
          > ☰ </button>
        </div>
      </div>

      {/* TABS */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTabId === "main" ? "active" : ""}`}
          onClick={() => setActiveTabId("main")}
        >
          Main
        </button>

        <button
          className={`sidebar-tab ${activeTabId === "npc" ? "active" : ""}`}
          onClick={() => setActiveTabId("npc")}
        >
          NPC
        </button>

        {sortedTabs.map(tab => (
          <button
            key={tab.id}
            className={`sidebar-tab ${activeTabId === tab.id ? "active" : ""}`}
            onClick={() => setActiveTabId(tab.id!)}
            onContextMenu={(e) => {
              e.preventDefault();
              handleDeleteTab(tab.id!);
            }}
          >
            {tab.name}
          </button>
        ))}

        <button
          className={`sidebar-tab sidebar-tab-shared ${activeTabId === "shared" ? "active" : ""}`}
          onClick={() => setActiveTabId("shared")}
        >
          Shared
        </button>

        <button className="sidebar-tab tab-add" onClick={handleAddTab} title="Nueva pestaña">
          +
        </button>
      </div>

      {/* BROWSE NPCS (top of shared tab only) */}
      {activeTabId === "shared" && (
        <div className="p-2">
          <button
            className="btn text-white add-character-btn browse-npcs-btn w-100"
            onClick={() => setShowBrowseNpcs(true)}
          >
            🔍 Browse NPCs
          </button>
        </div>
      )}

      {/* CHARACTER LIST */}
      <div className="sidebar-bottom p-3">
        <div className="character-list">
          {filteredCharacters.map((char) => (
            <CharacterDetails
              key={char.id}
              character={char}
              isActive={char.id === activeCharacterId}
              onSelect={() => selectCharacter(char.id!)}
              tabs={sortedTabs}
              onMoveToTab={handleMoveCharacter}
            />
          ))}

          {activeTabId !== "shared" && (
            <div className="mt-3 d-grid">
              <button
                className="btn text-white add-character-btn"
                onClick={handleAddCharacter}
              >
                + Add New Character
              </button>
            </div>
          )}
        </div>
      </div>

      {showBrowseNpcs && discordUser && (
        <BrowseNpcsPopup
          discordId={discordUser.id}
          onClose={() => setShowBrowseNpcs(false)}
          onImported={async (newCharId) => {
            await refreshCharacterList();
            selectCharacter(newCharId);
          }}
        />
      )}

      {promptState && (
        <PromptModal
          title={promptState.title}
          placeholder={promptState.placeholder}
          onSubmit={(value) => {
            promptResolveRef.current?.(value.trim() ? value : null);
            promptResolveRef.current = null;
            setPromptState(null);
          }}
          onCancel={() => {
            promptResolveRef.current?.(null);
            promptResolveRef.current = null;
            setPromptState(null);
          }}
        />
      )}

      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={() => {
            confirmResolveRef.current?.(true);
            confirmResolveRef.current = null;
            setConfirmState(null);
          }}
          onCancel={() => {
            confirmResolveRef.current?.(false);
            confirmResolveRef.current = null;
            setConfirmState(null);
          }}
        />
      )}
    </>
  );
}

export default ControlPanel;