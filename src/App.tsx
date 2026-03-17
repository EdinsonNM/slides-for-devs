import { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { usePresentation } from "./context/PresentationContext";
import {
  hasAnyApiConfiguredSync,
  hasAnyApiConfiguredAsync,
} from "./services/apiConfig";
import { checkForAppUpdates } from "./services/updater";
import { LoadingScreen } from "./components/shared/LoadingScreen";
import { Header } from "./components/layout/Header";
import { CharactersPanel } from "./components/layout/CharactersPanel";
import { SlideStylePanel } from "./components/layout/SlideStylePanel";
import { SlideSidebar } from "./components/layout/SlideSidebar";
import { HomeScreen } from "./components/home/HomeScreen";
import { WelcomeSignInPanel } from "./components/home/WelcomeSignInPanel";
import { ApiSetupScreen } from "./components/home/ApiSetupScreen";
import { useAuth } from "./context/AuthContext";
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
import { GeneratingPresentationModal } from "./components/modals/GeneratingPresentationModal";

interface HomeOrRedirectProps {
  onOpenConfig: () => void;
  showApiConfigModal: boolean;
  setShowApiConfigModal: (v: boolean) => void;
  skipLogin: boolean;
  onContinueWithoutAccount: () => void;
}

function HomeOrRedirect({
  onOpenConfig,
  showApiConfigModal,
  setShowApiConfigModal,
  skipLogin,
  onContinueWithoutAccount,
}: HomeOrRedirectProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    slides,
    handleOpenSaved,
    handleGenerate,
    refreshApiKeys,
  } = usePresentation();

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

  const handleApiConfigSaved = () => {
    refreshApiKeys();
    setShowApiConfigModal(false);
  };

  // Sin sesión: mostrar siempre la pantalla de login por defecto (salvo que elija "Continuar sin cuenta")
  if (!user && !skipLogin) {
    return (
      <>
        <WelcomeSignInPanel onContinueWithoutAccount={onContinueWithoutAccount} />
        <ApiConfigModal
          isOpen={showApiConfigModal}
          onClose={() => setShowApiConfigModal(false)}
          onSaved={handleApiConfigSaved}
        />
      </>
    );
  }

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
        onSaved={handleApiConfigSaved}
      />
    </>
  );
}

interface EditorLayoutProps {
  onOpenConfig: () => void;
}

function EditorLayout({ onOpenConfig }: EditorLayoutProps) {
  return (
    <div className="h-screen bg-surface-elevated flex flex-col font-sans overflow-hidden">
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

interface EditorRouteProps {
  onOpenConfig: () => void;
}

function EditorRoute({ onOpenConfig }: EditorRouteProps) {
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
  const { refreshApiKeys, pendingGeneration } = usePresentation();
  const [apiConfigVersion, setApiConfigVersion] = useState(0);
  const [showApiConfigModal, setShowApiConfigModal] = useState(false);
  const [skipLogin, setSkipLogin] = useState(false);
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
      <GeneratingPresentationModal isOpen={pendingGeneration !== null} />
      <ApiConfigModal
        isOpen={showApiConfigModal}
        onClose={() => setShowApiConfigModal(false)}
        onSaved={() => {
          refreshApiKeys();
          setShowApiConfigModal(false);
        }}
      />
      <Routes>
        <Route
          path="/"
          element={
            <HomeOrRedirect
              onOpenConfig={() => setShowApiConfigModal(true)}
              showApiConfigModal={showApiConfigModal}
              setShowApiConfigModal={setShowApiConfigModal}
              skipLogin={skipLogin}
              onContinueWithoutAccount={() => setSkipLogin(true)}
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
