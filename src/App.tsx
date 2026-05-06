import { useState, useEffect, useCallback } from 'react'
import './App.scss'
import ControlPanel from './Components/SideBar/SideBar.tsx'
import SectionNav from './Components/SectionNav.tsx'
import CharacterSheet from './Components/characters/CharacterSheet.tsx'
import { characterManager } from './Components/characters/CharacterManager.tsx' 
import type { Character } from './Components/characters/database/db.ts'
import { preloadMetadata } from './services/enteMetadataService.ts'

function App({ discordId }: { discordId: string | null }) {
	const [characters, setCharacters] = useState<Character[]>([])
	const [activeCharacterId, setActiveCharacterId] = useState<number | null>(null)
	const [sidebarHidden, setSidebarHidden] = useState(false)
	const [activeSection, setActiveSection] = useState<"loadout" | "entes" | "inventario">("entes")

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
			await refreshCharacters();
			preloadMetadata();
		}

		init();

		// Listen for all events that might change the character list
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

	return (
		<div className="container-fluid vh-100">
			<div className="row h-100">
				{/* Left panel */}
				<div className={`sidebar g-0 ${sidebarHidden ? 'hidden' : ''}`}>
					<ControlPanel
						sidebarHidden={sidebarHidden}
						setSidebarHidden={setSidebarHidden}
						setCharacters={setCharacters}
						characters={characters}
						activeCharacterId={activeCharacterId}
						setActiveCharacterId={setActiveCharacterId}
					/>
				</div>

				{/* Sidebar overlay – mobile only, taps close sidebar */}
				{!sidebarHidden && (
					<div
						className="sidebar-overlay"
						onClick={() => setSidebarHidden(true)}
					/>
				)}

				{/* Right panel */}
				<div className="col d-flex flex-column p-0">
					<div className="d-flex align-items-center">
						<div className="main">
							<div className='main-top'>
								<SectionNav
									activeSection={activeSection}
									setActiveSection={setActiveSection}
									sidebarHidden={sidebarHidden}
									onShowSidebar={() => setSidebarHidden(false)}
								/>
							</div>
							<div className="main-bottom">
								<CharacterSheet
									activeSection={activeSection}
									characterId={activeCharacterId}
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