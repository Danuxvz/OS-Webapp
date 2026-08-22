import LoadoutSection from "./loadout/LoadoutSection";
import EntesSection from "./entes/EntesSection";
import InventorySection from "./inventory/InventorySection";

import "./CharacterSheetStyles/CharacterSheet.scss";

interface CharacterSheetProps {
  activeSection: "entes" | "inventario" | "loadout";
  characterId: number | null;
  metadataVersion?: number;
  isNpcMode?: boolean;
}

function CharacterSheet({ activeSection, characterId, metadataVersion = 0, isNpcMode = false }: CharacterSheetProps) {
  return (
    <div className="character-sheet">
      <div className="section">
        {activeSection === "loadout" && (
          <LoadoutSection characterId={characterId} isNpcMode={isNpcMode} />
        )}

        {activeSection === "entes" && (
          <EntesSection key={`${characterId ?? "none"}-${metadataVersion}`} characterId={characterId} />
        )}

        {activeSection === "inventario" && (
          <InventorySection characterId={characterId} />
        )}
      </div>
    </div>
  );
}

export default CharacterSheet;