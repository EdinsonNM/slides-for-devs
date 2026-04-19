import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

/** Por encima del lienzo (`isolate` + bloques con z alto), inspector y toolbars típicos. */
const BASE_MODAL_PORTAL_Z = "z-[300]";

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabledBackdropClose?: boolean;
  /** Optional className for the content panel. */
  className?: string;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  disabledBackdropClose = false,
  className,
}: BaseModalProps) {
  if (!isOpen) return null;

  const handleBackdropPointerDown = (e: React.PointerEvent) => {
    if (disabledBackdropClose) return;
    /** Solo el overlay vacío cierra: evita cierre si el evento “atraviesa” capas o burbujea mal. */
    if (e.target !== e.currentTarget) return;
    onClose();
  };

  const stopSurfacePropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const node = (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center p-4 bg-black/50",
        BASE_MODAL_PORTAL_Z,
      )}
      onPointerDown={handleBackdropPointerDown}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="base-modal-title"
        aria-describedby={subtitle ? "base-modal-description" : undefined}
        className={cn(
          "bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col",
          className
        )}
        onPointerDown={stopSurfacePropagation}
        onMouseDown={stopSurfacePropagation}
        onClick={stopSurfacePropagation}
      >
        <div className="p-4 border-b border-stone-100 dark:border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {icon}
            <div className="min-w-0">
              <h3
                id="base-modal-title"
                className="font-medium text-stone-900 dark:text-foreground truncate"
              >
                {title}
              </h3>
              {subtitle && (
                <p
                  id="base-modal-description"
                  className="text-xs text-stone-500 dark:text-muted-foreground mt-0.5"
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors shrink-0",
              "text-stone-400 hover:bg-stone-100 hover:text-stone-600",
              "dark:text-muted-foreground dark:hover:bg-surface dark:hover:text-foreground",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-surface-elevated"
            )}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
