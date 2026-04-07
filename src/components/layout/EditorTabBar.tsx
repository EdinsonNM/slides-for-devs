import { X, Plus } from "lucide-react";
import { usePresentation } from "../../context/PresentationContext";
import { cn } from "../../utils/cn";

export function EditorTabBar({ className }: { className?: string }) {
  const {
    editorTabs,
    activeEditorTabId,
    switchEditorTab,
    addEditorTab,
    closeEditorTab,
  } = usePresentation();

  if (editorTabs.length === 0) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 items-stretch gap-0 bg-white dark:bg-surface-elevated",
        className,
      )}
    >
      <div className="flex items-stretch min-w-0 flex-1 overflow-x-auto carousel-no-scrollbar">
        {editorTabs.map((tab) => {
          const active = tab.id === activeEditorTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                "group flex max-w-[200px] min-w-[120px] shrink-0 items-center border-r border-stone-100 transition-colors dark:border-border",
                active
                  ? "bg-stone-50 text-foreground dark:bg-background"
                  : "bg-white text-muted-foreground hover:bg-stone-50/80 dark:bg-surface-elevated dark:hover:bg-white/6 hover:text-foreground",
              )}
            >
              <button
                type="button"
                className="flex-1 min-w-0 px-3 py-2 text-left text-[13px] font-medium truncate outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                onClick={() => switchEditorTab(tab.id)}
                title={tab.title}
              >
                {tab.title}
              </button>
              {editorTabs.length > 1 && (
                <button
                  type="button"
                  className={cn(
                    "shrink-0 p-1.5 mr-0.5 rounded-md opacity-70 hover:opacity-100 hover:bg-stone-200/60 dark:hover:bg-white/10 outline-none focus-visible:ring-1 focus-visible:ring-primary",
                    active && "opacity-90",
                  )}
                  aria-label={`Cerrar ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeEditorTab(tab.id);
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="flex shrink-0 items-center justify-center border-l border-stone-100 px-2.5 text-muted-foreground outline-none hover:bg-stone-50/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset dark:border-border dark:hover:bg-white/8"
        aria-label="Nueva pestaña"
        title="Nueva presentación (pestaña)"
        onClick={() => addEditorTab()}
      >
        <Plus size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
