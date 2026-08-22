import './ComponentStyles/SectionNav.scss';

interface SectionNavProps {
  activeSection: "entes" | "inventario" | "loadout";
  setActiveSection: (section: "entes" | "inventario" | "loadout") => void;
  sidebarHidden: boolean;
  onShowSidebar: () => void;
  isNpcMode?: boolean;
}

function SectionNav({
  activeSection,
  setActiveSection,
  sidebarHidden,
  onShowSidebar,
  isNpcMode = false,
}: SectionNavProps) {
  return (
    <div className="nav d-flex align-items-center">
      {sidebarHidden && (
        <button className="nav-burger" onClick={onShowSidebar}>☰</button>
      )}

      {isNpcMode ? (
        <>
          {/* NPC order: NPC Maker first */}
          <button
            className={`tab-btn ${activeSection === "loadout" ? "active" : ""}`}
            onClick={() => setActiveSection("loadout")}
          >
            NPC Maker
          </button>

          <button
            className={`tab-btn ${activeSection === "entes" ? "active" : ""}`}
            onClick={() => setActiveSection("entes")}
          >
            Entes
          </button>

          <button
            className={`tab-btn ${activeSection === "inventario" ? "active" : ""}`}
            onClick={() => setActiveSection("inventario")}
          >
            Inventario
          </button>
        </>
      ) : (
        <>
          {/* Main order: Entes, Loadout, Inventario */}
          <button
            className={`tab-btn ${activeSection === "entes" ? "active" : ""}`}
            onClick={() => setActiveSection("entes")}
          >
            Entes
          </button>

          <button
            className={`tab-btn ${activeSection === "loadout" ? "active" : ""}`}
            onClick={() => setActiveSection("loadout")}
          >
            Loadout
          </button>

          <button
            className={`tab-btn ${activeSection === "inventario" ? "active" : ""}`}
            onClick={() => setActiveSection("inventario")}
          >
            Inventario
          </button>
        </>
      )}
    </div>
  );
}

export default SectionNav;