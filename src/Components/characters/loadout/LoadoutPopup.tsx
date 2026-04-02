// LoadoutPopup.tsx
import type {
  Loadout,
  LoadoutHpSource,
  LoadoutWeaponSource,
  LoadoutHeSource,
  LoadoutACSource,
  LoadoutSlotSource,
} from "../../../types";
import HPSection from "./LoadoutPopupSections/HPSection";
import ATKSection from "./LoadoutPopupSections/ATKSection";
import WeaponSection from "./LoadoutPopupSections/WeaponSection";
import HESection from "./LoadoutPopupSections/HESection";
import ACSection from "./LoadoutPopupSections/ACSection";
import SlotsSection from "./LoadoutPopupSections/SlotsSection";
import NotesSection from "./LoadoutPopupSections/NotesSection";

interface Props {
  section: string;
  loadout: Loadout;
  hpSources: LoadoutHpSource[];
  atkSources: LoadoutHpSource[];
  weaponSources: LoadoutWeaponSource[];
  heSources: LoadoutHeSource[];
  acSources: LoadoutACSource[];
  slotSources: LoadoutSlotSource[];
  slotCardSources: { cardId: string; name: string; image?: string; amount: number }[];
  onClose: () => void;
  onSave: (loadout: Loadout) => void;
}

function LoadoutPopup({
  section,
  loadout,
  hpSources,
  atkSources,
  weaponSources,
  heSources,
  acSources,
  slotSources,
  slotCardSources,
  onClose,
  onSave,
}: Props) {
  const renderSection = () => {
    switch (section) {
      case "hp":
        return <HPSection loadout={loadout} hpSources={hpSources} onSave={onSave} />;
      case "atk":
        return <ATKSection loadout={loadout} atkSources={atkSources} onSave={onSave} />;
      case "weapon":
        return <WeaponSection loadout={loadout} weaponSources={weaponSources} onSave={onSave} />;
      case "he":
        return <HESection loadout={loadout} heSources={heSources} onSave={onSave} />;
      case "ac":
        return <ACSection loadout={loadout} acSources={acSources} onSave={onSave} />;
      case "slots":
        return (
          <SlotsSection
            loadout={loadout}
            slotSources={slotSources}
            slotCardSources={slotCardSources}
            onSave={onSave}
          />
        );
      case "notes":
        return <NotesSection loadout={loadout} onSave={onSave} />;
      default:
        return null;
    }
  };

  return (
    <div className="loadout-popup-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="loadout-popup card shadow-lg border-0" onClick={(e) => e.stopPropagation()}>
        <div className="card-body">
          {renderSection()}
          <div className="d-flex justify-content-end gap-2 mt-4">
            <button className="btn btn-outline-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadoutPopup;