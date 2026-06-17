import LoadoutSection from "./loadout/LoadoutSection";
import EntesSection from "./entes/EntesSection";
import InventorySection from "./inventory/InventorySection";

import "./CharacterSheetStyles/CharacterSheet.scss";

interface CharacterSheetProps {
	activeSection: "entes" | "inventario" | "loadout";
	characterId: number | null;
}

function CharacterSheet({ activeSection, characterId }: CharacterSheetProps) {
	return (
		<div className="character-sheet">
			<div className="section">
				{activeSection === "loadout" && (
					<LoadoutSection characterId={characterId} />
				)}

				{activeSection === "entes" && (
					<EntesSection key={characterId ?? "none"} characterId={characterId} />
				)}

				{activeSection === "inventario" && (
					<InventorySection characterId={characterId} />
				)}
			</div>
		</div>
	);
}

export default CharacterSheet;
