import { useEffect, useState } from "react";
import { characterManager } from "./CharacterManager";
import EntesSection from "./entes/EntesSection";

interface Props {
  discordId: string;
}

function CharacterBootstrap({ discordId }: Props) {
  const [activeCharacterId, setActiveCharacterId] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      let chars = await characterManager.getCharactersByUser(discordId);

      if (chars.length === 0) {
        const newId = await characterManager.createCharacter(discordId, "Default Character");
        setActiveCharacterId(newId);
      } else {
        setActiveCharacterId(chars[0].id!);
      }
    }

    init();
  }, [discordId]);

  if (!activeCharacterId) return <div>Loading...</div>;

  return (
    <EntesSection characterId={activeCharacterId} />
  );
}

export default CharacterBootstrap;
