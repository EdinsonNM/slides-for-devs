import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { usePresentation } from "./context/PresentationContext";
import {
  hasAnyApiConfiguredSync,
  hasAnyApiConfiguredAsync,
} from "./services/apiConfig";
import { checkForAppUpdates } from "./services/updater";
import { Header } from "./components/layout/Header";
import { CharactersPanel } from "./components/layout/CharactersPanel";
import { SlideStylePanel } from "./components/layout/SlideStylePanel";
import { SlideSidebar } from "./components/layout/SlideSidebar";
import { HomeScreen } from "./components/home/HomeScreen";
import { ApiSetupScreen } from "./components/home/ApiSetupScreen";
import { SlideEditor } from "./components/editor/SlideEditor";
import { PresenterNotesPanel } from "./components/editor/PresenterNotesPanel";
import { SavedListModal } from "./components/modals/SavedListModal";
import { ImageGenerationModal } from "./components/modals/ImageGenerationModal";
import { ImageUploadModal } from "./components/modals/ImageUploadModal";
import { CodeGenerationModal } from "./components/modals/CodeGenerationModal";
import { VideoUrlModal } from "./components/modals/VideoUrlModal";
import { SplitSlideModal } from "./components/modals/SplitSlideModal";
import { RewriteSlideModal } from "./components/modals/RewriteSlideModal";
import { SpeechModal } from "./components/modals/SpeechModal";
import { ApiConfigModal } from "./components/modals/ApiConfigModal";
import { CharacterCreatorModal } from "./components/modals/CharacterCreatorModal";
import { PreviewOverlay } from "./components/preview/PreviewOverlay";
import { PresenterView } from "./components/presenter/PresenterView";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F6F6F6] flex items-center justify-center font-sans">
      <div className="text-stone-500 flex items-center gap-2">
        <span className="inline-block w-5 h-5 border-2 border-stone-300 border-t-emerald-500 rounded-full animate-spin" />
        Cargando…
      </div>
    </div>
  );
}

function HomeOrRedirect({
  onOpenConfig,
  showApiConfigModal,
  setShowApiConfigModal,
}: {
  onOpenConfig: () => void;
  showApiConfigModal: boolean;
  setShowApiConfigModal: (v: boolean) => void;
}) {
  const { slides, handleOpenSaved, handleGenerate } = usePresentation();
  const navigate = useNavigate();
  if (slides.length > 0) {
    return <Navigate to="/editor" replace />;
  }
  const onOpenSavedAndGo = async (id: string) => {
    await handleOpenSaved(id);
    navigate("/editor");
  };
  const onGenerateAndGo = async (e: React.FormEvent) => {
    await handleGenerate(e);
    navigate("/editor");
  };
  return (
    <>
      <HomeScreen
        onOpenConfig={onOpenConfig}
        onCheckUpdates={() => checkForAppUpdates(false)}
        onOpenSaved={onOpenSavedAndGo}
        onGenerate={onGenerateAndGo}
      />
      <ApiConfigModal
        isOpen={showApiConfigModal}
        onClose={() => setShowApiConfigModal(false)}
        onSaved={() => setShowApiConfigModal(false)}
      />
    </>
  );
}

function EditorLayout({ onOpenConfig }: { onOpenConfig: () => void }) {
  return (
    <div className="h-screen bg-[#E4E3E0] flex flex-col font-sans overflow-hidden">
      <Header onOpenConfig={onOpenConfig} />
      <CharactersPanel />
      <SlideStylePanel />
      <main className="flex-1 flex overflow-hidden min-w-0">
        <SlideSidebar />
        <SlideEditor />
        <PresenterNotesPanel />
      </main>
      <SavedListModal />
      <CharacterCreatorModal />
      <ImageGenerationModal />
      <ImageUploadModal />
      <CodeGenerationModal />
      <VideoUrlModal />
      <SplitSlideModal />
      <RewriteSlideModal />
      <SpeechModal />
      <PreviewOverlay />
    </div>
  );
}

function EditorRoute({ onOpenConfig }: { onOpenConfig: () => void }) {
  const { slides, restoreLastOpenedPresentation } = usePresentation();
  const [restoring, setRestoring] = useState(true);
  const triedRestore = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (triedRestore.current) return;
    triedRestore.current = true;
    restoreLastOpenedPresentation()
      .then((ok) => {
        setRestoring(false);
        // Solo redirigir a home si no se restauró nada Y no hay diapositivas (evita parpadeo al venir de generar presentación).
        if (!ok && slides.length === 0) navigate("/", { replace: true });
      })
      .catch(() => {
        setRestoring(false);
        if (slides.length === 0) navigate("/", { replace: true });
      });
  }, [restoreLastOpenedPresentation, navigate, slides.length]);

  if (restoring) return <LoadingScreen />;
  if (slides.length === 0) return <Navigate to="/" replace />;
  return <EditorLayout onOpenConfig={onOpenConfig} />;
}

export default function App() {
  const location = useLocation();
  const [apiConfigVersion, setApiConfigVersion] = useState(0);
  const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  /** null = cargando (solo en Tauri), true = configurado, false = sin configurar */
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(() =>
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ === undefined
      ? hasAnyApiConfiguredSync()
      : null
  );

  const isPresenterWindow = location.pathname === "/presenter";

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
    return <LoadingScreen />;
  }

  return (
    <>
      <ApiConfigModal
        isOpen={showApiConfigModal}
        onClose={() => setShowApiConfigModal(false)}
        onSaved={() => setShowApiConfigModal(false)}
      />
      <Routes>
        <Route
          path="/"
          element={
            <HomeOrRedirect
              onOpenConfig={() => setShowApiConfigModal(true)}
              showApiConfigModal={showApiConfigModal}
              setShowApiConfigModal={setShowApiConfigModal}
            />
          }
        />
        <Route
          path="/editor"
          element={<EditorRoute onOpenConfig={() => setShowApiConfigModal(true)} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
