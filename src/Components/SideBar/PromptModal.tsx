import { useState } from "react";

interface Props {
  title: string;
  placeholder?: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

function PromptModal({ title, placeholder, initialValue = "", onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="stat-modal-overlay" onClick={onCancel}>
      <div className="stat-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onCancel}>
          ✕
        </button>

        <h3>{title}</h3>

        <input
          type="text"
          className="textInput"
          autoFocus
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit(value);
            if (e.key === "Escape") onCancel();
          }}
        />

        <div className="d-flex gap-2 mt-3">
          <button className="btn btn-primary btn-sm" onClick={() => onSubmit(value)}>
            Aceptar
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromptModal;