import { useEffect, useState } from "react";
import { Cuboid } from "lucide-react";
import { BaseModal } from "../modals/BaseModal";

export const CANVAS_3D_GLB_FILE_ACCEPT =
  ".glb,.gltf,model/gltf-binary,application/octet-stream";

export interface Canvas3dUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Valor inicial al abrir (p. ej. URL http actual). */
  initialUrl: string;
  onApply: (trimmedUrl: string) => void;
}

export function Canvas3dUrlModal({
  isOpen,
  onClose,
  initialUrl,
  onApply,
}: Canvas3dUrlModalProps) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (isOpen) setDraft(initialUrl.trim());
  }, [isOpen, initialUrl]);

  const apply = () => {
    const t = draft.trim();
    if (!t) return;
    onApply(t);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Modelo desde URL"
      subtitle="Pega la URL pública de un archivo .glb (el servidor debe permitir CORS)."
      icon={
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
          <Cuboid size={20} />
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-stone-600 dark:text-stone-400">
          <span className="font-medium text-stone-800 dark:text-stone-200">
            URL del archivo .glb
          </span>
          <input
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="https://ejemplo.com/modelo.glb"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-border dark:bg-surface dark:text-foreground"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-border dark:text-stone-200 dark:hover:bg-white/5"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!draft.trim()}
            onClick={apply}
          >
            Cargar modelo
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
