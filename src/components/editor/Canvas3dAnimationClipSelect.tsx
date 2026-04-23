import { cn } from "../../utils/cn";

const AUTO_VALUE = "__canvas3d_anim_auto__";
const NONE_VALUE = "";

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
    <label
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 dark:text-stone-300",
        className,
      )}
    >
      <span className="shrink-0">Animación</span>
      <select
        disabled={disabled}
        value={selectValue}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          if (v === AUTO_VALUE) onChange(undefined);
          else if (v === NONE_VALUE) onChange("");
          else onChange(v);
        }}
        className="max-w-[10rem] truncate rounded-md border border-stone-200 bg-white px-1.5 py-1 text-[11px] text-stone-800 shadow-sm dark:border-border dark:bg-stone-900 dark:text-stone-100"
      >
        <option value={AUTO_VALUE}>Automática (primera)</option>
        <option value={NONE_VALUE}>Sin animación</option>
        {clipNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
