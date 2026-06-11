import { useState, useEffect } from "react";
import EnteSkills from "./EnteSkills";
import type { Ente } from "../../../types";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener("resize", listener);
    return () => window.removeEventListener("resize", listener);
  }, [matches, query]);

  return matches;
}

interface Props {
  ente: Ente;
  onUpdate: (ente: Ente) => void;
  onDelete: (id: string) => void;
  computeUnlockLevel: (amount: number) => number;
  hideThumbnail?: boolean;
  onRandomizeDaruma?: (enteId: string) => void;
}

function EnteCard({ ente, onUpdate, onDelete, computeUnlockLevel, hideThumbnail, onRandomizeDaruma }: Props) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [amount, setAmount] = useState(ente.amount || 0);
  const [unlockLevel, setUnlockLevel] = useState(
    ente.unlockLevel || computeUnlockLevel(amount)
  );
  const [notes, setNotes] = useState(ente.notes || "");
  const [customImage, setCustomImage] = useState(ente.customImage || "");
  const [favorite, setFavorite] = useState(ente.favorite || false);
  const [showExtras, setShowExtras] = useState(
    !!ente.notes || !!ente.customImage
  );

  const hasExtras = showExtras;

  useEffect(() => {
    onUpdate({
      ...ente,
      amount,
      unlockLevel,
      notes,
      customImage,
      favorite,
    });
  }, [amount, unlockLevel, notes, customImage, favorite]);

  const handleCustomImage = () => {
    const url = prompt("Enter a URL for the custom image:", customImage || "");
    if (!url) return;
    setCustomImage(url.trim());
    setShowExtras(true);
  };

  const clearExtras = () => {
    setNotes("");
    setCustomImage("");
    setShowExtras(false);
  };

  const isDaruma = /^E123[A-J]$/i.test(ente.id);
  const canRandomize = isDaruma && (amount ?? 0) >= 2;

  // Only render the button for Daruma entes
  const darumaButton = (onRandomizeDaruma && isDaruma) ? (
    <button
      className="ente-daruma-btn"
      disabled={!canRandomize}
      title={canRandomize ? "Randomize Daruma color" : "Need at least 2 copies to randomize"}
      onClick={(e) => {
        e.stopPropagation();
        onRandomizeDaruma(ente.id);
      }}
    >
      🎲
    </button>
  ) : null;

  const actions = (
    <>
      <button
        className={`fav-btn ${favorite ? "active" : ""}`}
        onClick={() => setFavorite((prev) => !prev)}
      >
        ★
      </button>
      <button className="delete-ente-btn" onClick={() => onDelete(ente.id)}>
        🗑️
      </button>
      <input
        className="ente-amount-input"
        type="text"
        value={amount}
        onChange={(e) => {
          const v = Math.max(0, Number(e.target.value || 0));
          setAmount(v);
          setUnlockLevel(computeUnlockLevel(v));
        }}
      />
      {amount === 0 && <div className="ente-amount-warning">⚠️</div>}
      {darumaButton}
    </>
  );

  // thumbnail only shown if hideThumbnail is false
  const thumbnail = !hideThumbnail ? (
    <div className="ente-thumb-wrap" onClick={handleCustomImage}>
      {ente.image ? (
        <img className="ente-thumb" src={ente.image} alt={ente.id} />
      ) : (
        <div className="ente-thumbnail-placeholder">no image</div>
      )}
    </div>
  ) : null;

  const desktopLayout = (
    <div className="ente-top-row">
      <div className="ente-actions">{actions}</div>
      {thumbnail && <div className="ente-left">{thumbnail}</div>}
      <div className="ente-right">
        <EnteSkills ente={{ ...ente, unlockLevel }} />
      </div>
    </div>
  );

  const mobileLayout = (
    <div className="ente-top-row">
      <div className="mobile-left">
        <div className="ente-actions">{actions}</div>
        {thumbnail && <div className="ente-left">{thumbnail}</div>}
      </div>
      <div className="ente-right">
        <EnteSkills ente={{ ...ente, unlockLevel }} />
      </div>
    </div>
  );

  return (
    <div
      className="ente-item"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.tagName === "IMG" ||
          target.closest(".notes-text")
        ) {
          e.stopPropagation();
        }
      }}
    >
      {isMobile ? mobileLayout : desktopLayout}

      <div className="ente-bottom-row">
        {!hasExtras && (
          <div className="add-notes" onClick={() => setShowExtras(true)}>
            + Add notes
          </div>
        )}

        {hasExtras && (
          <div className="notes-wrapper">
            <button className="clear-notes-btn" onClick={clearExtras}>
              ×
            </button>

            {customImage && (
              <div className="custom-image-area">
                <img className="custom-img" src={customImage} alt="Custom" />
              </div>
            )}

            <textarea
              className="notes-text"
              placeholder="Add custom notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default EnteCard;