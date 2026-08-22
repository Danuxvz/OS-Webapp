interface Props {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="stat-modal-overlay" onClick={onCancel}>
      <div className="stat-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onCancel}>
          ✕
        </button>

        <p>{message}</p>

        <div className="d-flex gap-2 mt-3">
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;