import { cn } from "../../utils/cn";

const iconButtonVariants = {
  default:
    "text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-200 transition-colors",
  primary:
    "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/40 disabled:opacity-60 transition-colors",
  primarySolid:
    "bg-stone-800 text-white hover:bg-stone-700 dark:bg-primary dark:hover:bg-primary-hover dark:text-white transition-colors",
  violet:
    "text-stone-500 hover:bg-violet-100 hover:text-violet-600 dark:text-stone-400 dark:hover:bg-violet-900/50 dark:hover:text-violet-300 transition-colors",
  violetActive:
    "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300 transition-colors",
  amber:
    "text-stone-500 hover:bg-stone-100 hover:text-amber-600 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-amber-400 transition-colors",
  amberActive:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 transition-colors",
  emerald:
    "text-stone-500 hover:bg-emerald-100 hover:text-emerald-600 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-emerald-400 transition-colors",
  emeraldActive:
    "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300 transition-colors",
} as const;

export type IconButtonVariant = keyof typeof iconButtonVariants;

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: IconButtonVariant;
  active?: boolean;
  icon: React.ReactNode;
  /** Required for accessibility on icon-only buttons. */
  "aria-label": string;
  className?: string;
}

const variantToActiveVariant: Partial<Record<IconButtonVariant, IconButtonVariant>> = {
  violet: "violetActive",
  amber: "amberActive",
  emerald: "emeraldActive",
};

export function IconButton({
  variant = "default",
  active = false,
  icon,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  const effectiveVariant =
    active && variantToActiveVariant[variant]
      ? variantToActiveVariant[variant]!
      : variant;
  return (
    <button
      type="button"
      className={cn(
        "p-2 rounded-md shrink-0 inline-flex items-center justify-center disabled:pointer-events-none",
        iconButtonVariants[effectiveVariant],
        disabled && "opacity-60",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
}
