import { FaCheck, FaTimes } from "react-icons/fa";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 游戏内通用二次确认框，重玩、离开关卡等中断当前进度的操作共用。 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="game-overlay confirm-dialog-overlay">
      <div className="paper-card result-card confirm-dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{description}</p>
        <div className="confirm-dialog-actions">
          <button className="primary-button" type="button" onClick={onConfirm} aria-label={confirmLabel} title={confirmLabel}>
            <FaCheck aria-hidden="true" size={19} />
          </button>
          <button className="primary-button is-khaki" type="button" onClick={onCancel} aria-label={cancelLabel} title={cancelLabel}>
            <FaTimes aria-hidden="true" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
