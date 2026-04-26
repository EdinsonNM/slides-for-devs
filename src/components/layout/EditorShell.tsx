import { EditorLeftRail } from "./EditorLeftRail";
import { EditorTabBar } from "./EditorTabBar";
import { EditorFloatingToolbar } from "./EditorFloatingToolbar";
import { EditorInspector } from "./EditorInspector";
import { SlideSidebar } from "./SlideSidebar";
import { SlideEditor } from "../editor/SlideEditor";
import { AvatarMenu } from "../shared/AvatarMenu";
import { PresenterNotesPanel } from "../editor/PresenterNotesPanel";
import { usePresentation } from "../../presentation/contexts/PresentationContext";

interface EditorShellProps {
  onOpenConfig: () => void;
}

export function EditorShell({ onOpenConfig }: EditorShellProps) {
  const { isNotesPanelOpen, setIsNotesPanelOpen } = usePresentation();

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white text-foreground dark:bg-background font-sans">
      <div className="flex flex-1 min-h-0 min-w-0">
        <EditorLeftRail onOpenConfig={onOpenConfig} />
        <div className="flex flex-1 min-w-0 min-h-0 flex-col">
          <header className="flex h-9 shrink-0 items-stretch border-b border-stone-200/90 bg-white dark:border-border dark:bg-surface-elevated">
            <EditorTabBar className="min-w-0 flex-1" />
            <div className="flex items-center border-l border-stone-200/90 bg-white px-1.5 dark:border-border dark:bg-surface-elevated">
              <AvatarMenu onOpenConfig={onOpenConfig} variant="editor" />
            </div>
          </header>
          <div className="flex flex-1 min-h-0 min-w-0">
            <SlideSidebar />
            <div className="relative flex flex-1 min-w-0 min-h-0 flex-col bg-white dark:bg-surface">
              <SlideEditor />
              <EditorFloatingToolbar onOpenConfig={onOpenConfig} />
              {isNotesPanelOpen ? (
                <div className="fixed inset-x-0 bottom-0 z-40 max-h-[min(70vh,520px)] flex flex-col rounded-t-2xl border border-stone-200 bg-white shadow-2xl dark:border-border dark:bg-surface-elevated lg:hidden">
                  <button
                    type="button"
                    className="flex w-full shrink-0 flex-col items-center gap-1 py-2"
                    aria-label="Cerrar notas"
                    onClick={() => setIsNotesPanelOpen(false)}
                  >
                    <span className="h-1 w-10 rounded-full bg-muted-foreground/40" />
                    <span className="text-[10px] text-muted-foreground">Cerrar</span>
                  </button>
                  <div className="min-h-0 flex-1 overflow-hidden border-t border-stone-200 dark:border-border">
                    <PresenterNotesPanel variant="inspector" />
                  </div>
                </div>
              ) : null}
            </div>
            <EditorInspector />
          </div>
        </div>
      </div>
    </div>
  );
}
