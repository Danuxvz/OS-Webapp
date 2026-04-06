import { useState, useEffect } from "react";
import type { Character } from '../characters/database/db';
import CharacterDetails from "./CharacterDetails.tsx";
import { refreshMetadata } from '../../services/enteMetadataService.ts';
import { characterManager } from '../characters/CharacterManager';
import { getLoggedInDiscordUser, logout } from '../../services/SupaBase.ts';
import { syncAll } from '../../services/Sync.tsx';
import '../ComponentStyles/SideBar.scss';

// Discord user info interface
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
}

function ControlPanel({
	sidebarHidden,
	setSidebarHidden,
	characters,
	setCharacters,
	activeCharacterId,
	setActiveCharacterId
}: SidebarProps) {

	const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);

	/* =========================
		FETCH LOGGED IN DISCORD USER
	========================= */
	useEffect(() => {
		async function fetchUser() {
			const user = await getLoggedInDiscordUser();
			setDiscordUser(user);
		}
		fetchUser();
	}, []);

	/* =========================
		MANAGE CHARACTERS
	========================= */
	const handleAddCharacter = async () => {
		const name = "New Character";
		const newCharId = await characterManager.createCharacter(discordUser?.id ?? "", name);
		const updatedChars = await characterManager.getCharactersByUser(discordUser?.id ?? "");
		setCharacters(updatedChars);
		setActiveCharacterId(newCharId);
	};

	useEffect(() => {
		function handleDeleted(id: number) {
			setCharacters(prev => prev.filter(c => c.id !== id));

			setActiveCharacterId(prev =>
				prev === id ? null : prev
			);
		}

		characterManager.on("characterDeleted", handleDeleted);

		return () => {
			characterManager.off("characterDeleted", handleDeleted);
		};

	}, []);


	/* =========================
		LOGOUT HANDLER
	========================= */
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
				{/* Discord Avatar */}
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

				{/* Discord Sync Button */}
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

				{/* Sidebar Toggle */}
				<div id="toggleSidebar" className="d-flex align-items-center ms-2">
					<button className="btn btn-sm btn-outline-dark me-2 burger-btn"
						onClick={() => setSidebarHidden(!sidebarHidden)}
					> ☰ </button>
				</div>
			</div>

			{/* BOTTOM: CHARACTER LIST */}
			<div className="sidebar-bottom p-3">
				<div className="character-list">
					{characters.map((char) => (
						<CharacterDetails
							key={char.id}
							character={char}
							isActive={char.id === activeCharacterId}
							onSelect={() => setActiveCharacterId(char.id!)}
						/>
					))}

					{/* Add New Character Button */}
					<div className="mt-3 d-grid">
						<button
							className="btn text-white add-character-btn"
							onClick={handleAddCharacter}
						>
							+ Add New Character
						</button>
					</div>
				</div>
			</div>
		</>
	);
}

export default ControlPanel;