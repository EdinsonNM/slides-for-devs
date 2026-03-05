import { useState, useEffect } from "react";
import { usePresentation } from "./context/PresentationContext";
import {
  hasAnyApiConfiguredSync,
  hasAnyApiConfiguredAsync,
} from "./services/apiConfig";
import { checkForAppUpdates } from "./services/updater";
import { Header } from "./components/layout/Header";
import { SlideSidebar } from "./components/layout/SlideSidebar";
import { HomeScreen } from "./components/home/HomeScreen";
import { ApiSetupScreen } from "./components/home/ApiSetupScreen";
import { SlideEditor } from "./components/editor/SlideEditor";
import { PresenterNotesPanel } from "./components/editor/PresenterNotesPanel";
import { SavedListModal } from "./components/modals/SavedListModal";
import { ImageGenerationModal } from "./components/modals/ImageGenerationModal";
import { CodeGenerationModal } from "./components/modals/CodeGenerationModal";
import { VideoUrlModal } from "./components/modals/VideoUrlModal";
import { SplitSlideModal } from "./components/modals/SplitSlideModal";
import { RewriteSlideModal } from "./components/modals/RewriteSlideModal";
import { SpeechModal } from "./components/modals/SpeechModal";
import { ApiConfigModal } from "./components/modals/ApiConfigModal";
import { PreviewOverlay } from "./components/preview/PreviewOverlay";
import { PresenterView } from "./components/presenter/PresenterView";

export default function App() {
  const { slides } = usePresentation();
  const [isPresenterWindow, setIsPresenterWindow] = useState(
    () => window.location.hash === "#/presenter"
  );
  const [apiConfigVersion, setApiConfigVersion] = useState(0);
  const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  /** null = cargando (solo en Tauri), true = configurado, false = sin configurar */
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(() =>
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ === undefined
      ? hasAnyApiConfiguredSync()
      : null
  );

  useEffect(() => {
    const onHash = () =>
      setIsPresenterWindow(window.location.hash === "#/presenter");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (apiConfigured !== null) return;
    hasAnyApiConfiguredAsync().then(setApiConfigured);
  }, [apiConfigured]);

  useEffect(() => {
    const t = setTimeout(() => {
      checkForAppUpdates();
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  if (isPresenterWindow) {
    return <PresenterView />;
  }

  if (apiConfigured === false) {
    return (
      <ApiSetupScreen
        onConfigured={() => {
          setApiConfigVersion((v) => v + 1);
          setApiConfigured(true);
        }}
      />
    );
  }

  if (apiConfigured === null) {
    return (
      <div className="min-h-screen bg-[#F6F6F6] flex items-center justify-center font-sans">
        <div className="text-stone-500 flex items-center gap-2">
          <span className="inline-block w-5 h-5 border-2 border-stone-300 border-t-emerald-500 rounded-full animate-spin" />
          Cargando…
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <>
        <HomeScreen onOpenConfig={() => setShowApiConfigModal(true)} />
        <ApiConfigModal
          isOpen={showApiConfigModal}
          onClose={() => setShowApiConfigModal(false)}
          onSaved={() => setShowApiConfigModal(false)}
        />
      </>
    );
  }

  return (
    <div className="h-screen bg-[#E4E3E0] flex flex-col font-sans overflow-hidden">
      <Header onOpenConfig={() => setShowApiConfigModal(true)} />
      <ApiConfigModal
        isOpen={showApiConfigModal}
        onClose={() => setShowApiConfigModal(false)}
        onSaved={() => setShowApiConfigModal(false)}
      />
      <main className="flex-1 flex overflow-hidden min-w-0">
        <SlideSidebar />
        <SlideEditor />
        <PresenterNotesPanel />
      </main>
      <SavedListModal />
      <ImageGenerationModal />
      <CodeGenerationModal />
      <VideoUrlModal />
      <SplitSlideModal />
      <RewriteSlideModal />
      <SpeechModal />
      <PreviewOverlay />
    </div>
  );
}
