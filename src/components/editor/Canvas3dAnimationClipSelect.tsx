import { cn } from "../../utils/cn";

const AUTO_VALUE = "__canvas3d_anim_auto__";
/** Valor interno del `<select>`; en slide se guarda como `""`. */
const NONE_VALUE = "__canvas3d_anim_none__";

export interface Canvas3dAnimationClipSelectProps {
  clipNames: string[];
  /** `undefined` = primera animación del archivo; `""` = ninguna; nombre = ese clip. */
  value: string | undefined;
  onChange: (clipName: string | undefined) => void;
  className?: string;
  disabled?: boolean;
}

export function Canvas3dAnimationClipSelect({
  clipNames,
  value,
  onChange,
  className,
  disabled,
}: Canvas3dAnimationClipSelectProps) {
  if (clipNames.length === 0) return null;

  const selectValue =
    value === undefined
      ? AUTO_VALUE
      : value === ""
        ? NONE_VALUE
        : clipNames.includes(value)
          ? value
          : AUTO_VALUE;

  return (
    <div
      className={cn(
        "inline-flex min-w-[10.5rem] max-w-[min(100%,14rem)] shrink-0 basis-auto items-stretch rounded-lg border border-stone-200/90 bg-white/95 px-1.5 py-0.5 shadow-sm backdrop-blur-sm dark:border-border dark:bg-stone-900/90",
        className,
      )}
    >
      <select
        aria-label="Clip de animación del modelo 3D"
        title="Animación del modelo"
        disabled={disabled}
        value={selectValue}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          if (v === AUTO_VALUE) onChange(undefined);
          else if (v === NONE_VALUE) onChange("");
          else onChange(v);
        }}
        className={cn(
          "w-full min-w-0 flex-1 cursor-pointer border-0 bg-transparent px-1 py-1 text-left text-[11px] font-medium text-stone-800 shadow-none ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 dark:text-stone-100",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <option value={AUTO_VALUE}>Automática (primera)</option>
        <option value={NONE_VALUE}>Sin animación</option>
        {clipNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
