import type { Loadout } from "../../../../types";

interface Props {
  loadout: Loadout;
  onSave: (loadout: Loadout) => void;
}

function NotesSection({ loadout, onSave }: Props) {
  const notes = loadout.data.notes ?? "";

  return (
    <>
      <h3 className="h5 mb-3">Notes</h3>
      <label className="form-label">Loadout Notes</label>
      <textarea
        className="form-control"
        rows={5}
        value={notes}
        onChange={(e) =>
          onSave({
            ...loadout,
            data: {
              ...loadout.data,
              notes: e.target.value,
            },
          })
        }
      />
    </>
  );
}

export default NotesSection;