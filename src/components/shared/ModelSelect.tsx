import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";
import type { PresentationProvider } from "../../constants/presentationModels";
import { PresentationProviderIcon } from "./PresentationProviderIcon";

export interface ModelSelectOption {
  id: string;
  label: string;
  provider?: PresentationProvider;
  /** Explicación breve en el listado (p. ej. cuándo conviene esta opción). */
  description?: string;
}

export interface ModelSelectProps {
  value: string;
  options: ModelSelectOption[];
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  /** "sm" for Header, "xs" for compact PromptInput */
  size?: "xs" | "sm";
  /** "ghost": sin borde fuerte (p. ej. prompt home); "field": control con borde (config). */
  appearance?: "field" | "ghost";
  title?: string;
  "aria-label"?: string;
}

const LIST_MAX_HEIGHT = 260;
const GAP = 4;
/** Ancho máximo del menú desplegable (compacto). */
const LIST_MAX_WIDTH = 232;

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
  appearance = "field",
  title,
  "aria-label": ariaLabel,
}: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [listStyle, setListStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    openUp?: boolean;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listIdRef = useRef("model-select-list-" + Math.random().toString(36).slice(2, 9));
  const listId = listIdRef.current;

  const selected = options.find((o) => o.id === value);
  const displayLabel = selected?.label ?? value;
  const selectedProvider = selected?.provider;
  const triggerTitle = title ?? selected?.description;

  const listHasDescriptions = options.some((o) => Boolean(o.description));

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < LIST_MAX_HEIGHT + GAP && spaceAbove > spaceBelow;
    const vw = window.innerWidth;
    const margin = 12;
    const maxW = Math.min(LIST_MAX_WIDTH, vw - margin * 2);
    const targetW = Math.min(
      maxW,
      Math.max(rect.width, listHasDescriptions ? 188 : 156),
    );
    let left = rect.left;
    if (left + targetW > vw - margin) {
      left = Math.max(margin, vw - margin - targetW);
    }
    setListStyle({
      top: openUp ? undefined : rect.bottom + GAP,
      bottom: openUp ? window.innerHeight - rect.top + GAP : undefined,
      left,
      width: targetW,
      openUp,
    });
  }, [open, listHasDescriptions]);

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

  const ghost = appearance === "ghost";
  const iconSize = size === "xs" ? 14 : 15;

  const listElement =
    open && listStyle && typeof document !== "undefined" ? (
      <ul
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        className={cn(
          "fixed z-9999 overflow-y-auto rounded-lg border py-1 shadow-lg",
          "bg-white dark:bg-surface-elevated border-stone-200 dark:border-border",
          "custom-scrollbar",
        )}
        style={{
          top: listStyle.top,
          bottom: listStyle.bottom,
          left: listStyle.left,
          width: listStyle.width,
          maxHeight: LIST_MAX_HEIGHT,
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
              title={opt.description}
              className={cn(
                "flex min-w-0 cursor-pointer gap-2 text-left text-xs transition-colors",
                opt.description
                  ? cn(
                      "items-start",
                      size === "xs" ? "py-2 px-2.5" : "py-2.5 px-3",
                    )
                  : cn(
                      "items-center",
                      size === "xs" ? "py-1.5 px-2" : "py-2 px-3",
                    ),
                isSelected
                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-700 dark:hover:text-foreground",
              )}
            >
              {opt.provider ? (
                <span className={cn("shrink-0", opt.description && "pt-0.5")}>
                  <PresentationProviderIcon provider={opt.provider} size={14} />
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "truncate",
                    isSelected ? "font-semibold" : "font-medium text-stone-800 dark:text-stone-100",
                  )}
                >
                  {opt.label}
                </span>
                {opt.description ? (
                  <span
                    className={cn(
                      "hyphens-auto text-left text-[10.5px] leading-snug text-stone-500 wrap-anywhere dark:text-stone-400",
                      isSelected && "text-emerald-900 dark:text-emerald-100",
                    )}
                  >
                    {opt.description}
                  </span>
                ) : null}
              </span>
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
          title={triggerTitle}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-describedby={open ? listId : undefined}
          className={cn(
            "flex w-full min-w-0 max-w-44 cursor-pointer items-center gap-1.5 text-left sm:max-w-52",
            "focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
            sizeClasses,
            ghost
              ? cn(
                  "justify-between rounded-full border-0",
                  "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
                  "hover:bg-stone-200 dark:hover:bg-stone-700",
                  "focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-0",
                  open && "bg-stone-200 dark:bg-stone-700",
                )
              : cn(
                  "justify-between truncate rounded-lg border transition-colors",
                  "border-stone-200 bg-white text-stone-600 dark:border-border dark:bg-surface-elevated dark:text-foreground",
                  "hover:border-stone-300 hover:bg-stone-50 dark:hover:border-stone-500 dark:hover:bg-stone-700",
                  "focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40",
                ),
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            {selectedProvider ? (
              <PresentationProviderIcon provider={selectedProvider} size={iconSize} />
            ) : null}
            <span className="truncate">{displayLabel}</span>
          </span>
          <ChevronDown
            size={size === "xs" ? 12 : 14}
            className={cn(
              "shrink-0 text-stone-500 transition-transform dark:text-stone-400",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      {listElement && createPortal(listElement, document.body)}
    </>
  );
}
