import { X } from "lucide-react";

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabledBackdropClose?: boolean;
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  disabledBackdropClose = false,
}: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => !disabledBackdropClose && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h3 className="font-medium text-stone-900">{title}</h3>
              {subtitle && <p className="text-xs text-stone-500">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
