import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

export interface ModelSelectOption {
  id: string;
  label: string;
}

export interface ModelSelectProps {
  value: string;
  options: ModelSelectOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  /** "sm" for Header, "xs" for compact PromptInput */
  size?: "xs" | "sm";
  title?: string;
  "aria-label"?: string;
}

const LIST_MAX_HEIGHT = 280;
const GAP = 4;

/**
 * Combo personalizado para selección de modelo. Estilo minimalista, soporte dark mode.
 * La lista se renderiza en un portal para no ser recortada por overflow-hidden del padre.
 */
export function ModelSelect({
  value,
  options,
  onChange,
  disabled = false,
  className,
  size = "sm",
  title,
  "aria-label": ariaLabel,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    minWidth: number;
    openUp?: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listIdRef = useRef("model-select-list-" + Math.random().toString(36).slice(2, 9));
  const listId = listIdRef.current;

  const selected = options.find((o) => o.id === value);
  const displayLabel = selected?.label ?? value;

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < LIST_MAX_HEIGHT + GAP && spaceAbove > spaceBelow;
    setListStyle({
      top: openUp ? undefined : rect.bottom + GAP,
      bottom: openUp ? window.innerHeight - rect.top + GAP : undefined,
      left: rect.left,
      minWidth: Math.max(rect.width, 180),
      openUp,
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

  const sizeClasses =
    size === "xs"
      ? "text-xs py-1.5 px-2 min-h-[28px]"
      : "text-xs py-2 px-3 min-h-[32px]";

  const listElement =
    open && listStyle && typeof document !== "undefined" ? (
      <ul
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        className={cn(
          "fixed py-1 rounded-lg border shadow-lg z-[9999] min-w-[180px] max-h-[280px] overflow-y-auto",
          "bg-white dark:bg-surface-elevated border-stone-200 dark:border-border",
          "custom-scrollbar"
        )}
        style={{
          top: listStyle.top,
          bottom: listStyle.bottom,
          left: listStyle.left,
          minWidth: listStyle.minWidth,
        }}
      >
        {options.map((opt) => {
          const isSelected = opt.id === value;
          return (
            <li
              key={opt.id}
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(opt.id);
                  setOpen(false);
                }
              }}
              className={cn(
                "px-3 py-2 text-left cursor-pointer transition-colors truncate",
                size === "xs" ? "text-xs py-1.5 px-2" : "text-xs py-2 px-3",
                isSelected
                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium"
                  : "text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700/80 hover:text-stone-900 dark:hover:text-foreground"
              )}
            >
              {opt.label}
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => !disabled && setOpen((o) => !o)}
          disabled={disabled}
          title={title}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-describedby={open ? listId : undefined}
          className={cn(
            "w-full flex items-center justify-between gap-2 rounded-lg border transition-colors cursor-pointer text-left truncate max-w-[200px]",
            "bg-white dark:bg-surface-elevated border-stone-200 dark:border-border",
            "text-stone-600 dark:text-foreground",
            "hover:border-stone-300 dark:hover:border-stone-500 hover:bg-stone-50 dark:hover:bg-stone-700/50",
            "focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            sizeClasses
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown
            size={size === "xs" ? 14 : 16}
            className={cn("shrink-0 text-stone-400 dark:text-stone-500 transition-transform", open && "rotate-180")}
          />
        </button>
      </div>
      {listElement && createPortal(listElement, document.body)}
    </>
  );
}
