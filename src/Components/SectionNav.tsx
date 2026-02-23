import './ComponentStyles/SectionNav.scss';

interface SectionNavProps {
  sidebarHidden: boolean;
  onShowSidebar: () => void;
}

interface SectionNavProps {
  activeSection: "entes" | "inventario" | "loadout";
  setActiveSection: (section: "entes" | "inventario" | "loadout") => void;
  sidebarHidden: boolean;
  onShowSidebar: () => void;
}

function SectionNav({
  activeSection,
  setActiveSection,
  sidebarHidden,
  onShowSidebar,
}: SectionNavProps) {
  return (
    <div className="nav d-flex align-items-center">

      {sidebarHidden && (
        <button
          className="nav-burger"
          onClick={onShowSidebar}
        >
          ☰
        </button>
      )}

      <button
        className={`tab-btn ${activeSection === "entes" ? "active" : ""}`}
        onClick={() => setActiveSection("entes")}
      >
        Entes
      </button>

      {/* <button
        className={`tab-btn ${activeSection === "loadout" ? "active" : ""}`}
        onClick={() => setActiveSection("loadout")}
      >
        Loadout
      </button> */}

      <button
        className={`tab-btn ${activeSection === "inventario" ? "active" : ""}`}
        onClick={() => setActiveSection("inventario")}
      >
        Inventario
      </button>


    </div>
  );
}



export default SectionNav;