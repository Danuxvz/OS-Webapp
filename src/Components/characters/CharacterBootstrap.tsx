import { useEffect, useState } from "react";
import { characterManager } from "./CharacterManager";
import EntesSection from "./entes/EntesSection";
import Loading from "../Loading";

interface Props {
  discordId: string;
}

function CharacterBootstrap({ discordId }: Props) {
  const [activeCharacterId, setActiveCharacterId] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      const chars = await characterManager.getCharactersByUser(discordId);

      if (chars.length === 0) {
        const newId = await characterManager.createCharacter(discordId, "Default Character");
        setActiveCharacterId(newId);
      } else {
        setActiveCharacterId(chars[0].id!);
      }
    }

    init();
  }, [discordId]);

  if (!activeCharacterId) return <Loading />;

  return (
    <EntesSection characterId={activeCharacterId} />
  );
}

export default CharacterBootstrap;