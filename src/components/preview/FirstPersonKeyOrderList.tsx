import { useCallback, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  FIRST_PERSON_LAYOUT_LABELS,
  type FirstPersonLayout,
} from "../../constants/firstPersonLayout";
import { cn } from "../../utils/cn";

const KEY_LABELS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
] as const;

function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) {
    return arr;
  }
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return arr;
  next.splice(to, 0, moved);
  return next;
}

export function FirstPersonKeyOrderList({
  order,
  onOrderChange,
  className,
}: {
  order: FirstPersonLayout[];
  onOrderChange: (next: FirstPersonLayout[]) => void;
  className?: string;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const onDragStart = useCallback(
    (i: number) => (e: React.DragEvent) => {
      setDragIndex(i);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(i));
    },
    [],
  );

  const onDragOver = useCallback(
    (i: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverIndex(i);
    },
    [],
  );

  const onDrop = useCallback(
    (to: number) => (e: React.DragEvent) => {
      e.preventDefault();
      const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (!Number.isFinite(from)) {
        setDragIndex(null);
        setOverIndex(null);
        return;
      }
      onOrderChange(reorderArray(order, from, to));
      setDragIndex(null);
      setOverIndex(null);
    },
    [onOrderChange, order],
  );

  const onDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  if (order.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-lg border border-stone-600/80 bg-stone-900/95 p-2 text-left shadow-xl",
        className,
      )}
      role="list"
      aria-label="Orden de atajos 1 a 0"
    >
      <p className="mb-2 px-1 text-xs text-stone-400">
        Arrastra para definir qué vista activa la tecla{" "}
        <kbd className="rounded bg-stone-700 px-1">1</kbd>–<kbd className="rounded bg-stone-700 px-1">0</kbd> (fila
        numérica o teclado numérico).
      </p>
      <ul className="flex flex-col gap-0.5">
        {order.map((layout, i) => {
          const k = i < 10 ? KEY_LABELS[i] : `+${i - 9}`;
          const label = FIRST_PERSON_LAYOUT_LABELS[layout] ?? layout;
          const isOver = overIndex === i && dragIndex !== i;
          return (
            <li
              key={layout}
              role="listitem"
              className={cn(
                "flex items-center gap-2 rounded-md border border-transparent py-1.5 pl-1 pr-2 text-sm",
                isOver && "border-amber-400/50 bg-amber-950/30",
                dragIndex === i && "opacity-60",
              )}
              onDragOver={onDragOver(i)}
              onDrop={onDrop(i)}
              onDragEnd={onDragEnd}
            >
              <span
                className="inline-flex w-6 shrink-0 justify-center font-mono text-xs text-amber-300/90"
                aria-hidden
              >
                {k}
              </span>
              <div
                draggable
                onDragStart={onDragStart(i)}
                className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 rounded border border-stone-600/60 bg-stone-800/80 px-2 py-1 active:cursor-grabbing"
                title="Arrastrar para reordenar atajos"
              >
                <GripVertical
                  className="size-3.5 shrink-0 text-stone-500"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-stone-100">{label}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
