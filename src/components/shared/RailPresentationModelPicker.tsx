import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  PRESENTATION_MODELS,
  type PresentationModelOption,
} from "../../constants/presentationModels";
import { usePresentation } from "@/presentation/contexts/PresentationContext";
import { cn } from "../../utils/cn";
import { PresentationProviderGlyph } from "./PresentationProviderGlyph";

const LIST_MAX_HEIGHT = 320;
const GAP = 6;

interface RailPresentationModelPickerProps {
  triggerClassName: string;
}

export function RailPresentationModelPicker({
  triggerClassName,
}: RailPresentationModelPickerProps) {
  const { presentationModelId, setPresentationModelId, presentationModels } =
    usePresentation();
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    minWidth: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listIdRef = useRef(`rail-model-list-${Math.random().toString(36).slice(2, 9)}`);
  const listId = listIdRef.current;

  const selected: PresentationModelOption | undefined =
    presentationModels.find((m) => m.id === presentationModelId) ??
    PRESENTATION_MODELS.find((m) => m.id === presentationModelId);

  const hasOptions = presentationModels.length > 0;

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < LIST_MAX_HEIGHT + GAP && spaceAbove > spaceBelow;
    const minWidth = Math.max(220, rect.width + 120);
    let left = rect.right + GAP;
    if (left + minWidth > window.innerWidth - 10) {
      left = Math.max(10, rect.left - minWidth - GAP);
    }
    setListStyle({
      top: openUp ? undefined : rect.bottom + GAP,
      bottom: openUp ? window.innerHeight - rect.top + GAP : undefined,
      left,
      minWidth,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const listEl = document.getElementById(listId);
      if (listEl?.contains(target)) return;
      setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, listId]);

  const listElement =
    open && listStyle && hasOptions && typeof document !== "undefined" ? (
      <ul
        id={listId}
        role="listbox"
        aria-label="Modelo de IA para generación"
        className={cn(
          "fixed z-9999 max-h-[320px] min-w-[220px] overflow-y-auto rounded-lg border py-1 shadow-lg",
          "border-stone-200 bg-white dark:border-border dark:bg-surface-elevated",
          "custom-scrollbar",
        )}
        style={{
          top: listStyle.top,
          bottom: listStyle.bottom,
          left: listStyle.left,
          minWidth: listStyle.minWidth,
          maxHeight: LIST_MAX_HEIGHT,
        }}
      >
        {presentationModels.map((opt) => {
          const isSelected = opt.id === presentationModelId;
          return (
            <li
              key={opt.id}
              role="option"
              aria-selected={isSelected}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors",
                isSelected
                  ? "bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200"
                  : "text-stone-700 hover:bg-stone-50 dark:text-stone-200 dark:hover:bg-stone-700/80",
              )}
              onClick={() => {
                setPresentationModelId(opt.id);
                setOpen(false);
              }}
            >
              <PresentationProviderGlyph provider={opt.provider} className="size-4" />
              <span className="min-w-0 flex-1 truncate">{opt.label}</span>
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div className="relative flex size-full min-h-0 items-center justify-center">
      <button
        ref={triggerRef}
        type="button"
        disabled={!hasOptions}
        onClick={() => hasOptions && setOpen((o) => !o)}
        aria-label="Elegir modelo de IA"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label}
        className={cn(
          "relative flex size-full min-h-9 min-w-9 items-center justify-center rounded-lg outline-none",
          "text-foreground/90 hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-primary",
          "disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-white/10",
          triggerClassName,
        )}
      >
        {hasOptions && selected ? (
          <>
            <PresentationProviderGlyph provider={selected.provider} />
            <ChevronDown
              size={10}
              strokeWidth={2.5}
              className={cn(
                "pointer-events-none absolute bottom-0.5 right-0.5 text-stone-500 opacity-80 dark:text-stone-400",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </>
        ) : (
          <SlidersHorizontal size={18} strokeWidth={2} className="text-muted-foreground" />
        )}
      </button>
      {listElement && createPortal(listElement, document.body)}
    </div>
  );
}
