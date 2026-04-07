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
import { CloudPresentationsModal } from "./components/modals/CloudPresentationsModal";
import { SharePresentationModal } from "./components/modals/SharePresentationModal";
import { CloudSyncConflictModal } from "./components/modals/CloudSyncConflictModal";
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
import { GenerateFullDeckModal } from "./components/modals/GenerateFullDeckModal";
import { GenerateSlideContentModal } from "./components/modals/GenerateSlideContentModal";

interface HomeOrRedirectProps {
  onOpenConfig: () => void;
  showApiConfigModal: boolean;
  setShowApiConfigModal: (v: boolean) => void;
  skipLogin: boolean;
  onContinueWithoutAccount: () => void;
  onBackToWelcome: () => void;
}

function HomeOrRedirect({
  onOpenConfig,
  showApiConfigModal,
  setShowApiConfigModal,
  skipLogin,
  onContinueWithoutAccount,
  onBackToWelcome,
}: HomeOrRedirectProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    slides,
    handleOpenSaved,
    handleGenerate,
    createBlankPresentation,
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

  const onCreateBlankAndGo = async () => {
    await createBlankPresentation();
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
        onBackToWelcome={!user ? onBackToWelcome : undefined}
        onCheckUpdates={() => checkForAppUpdates(false)}
        onOpenSaved={onOpenSavedAndGo}
        onGenerate={onGenerateAndGo}
        onCreateBlank={onCreateBlankAndGo}
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
      <GenerateFullDeckModal />
      <GenerateSlideContentModal />
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
  const {
    refreshApiKeys,
    pendingGeneration,
    showCloudPresentationsModal,
    setShowCloudPresentationsModal,
    cloudPresentationsItems,
    cloudModalLoading,
    cloudModalError,
    cloudSharedWarning,
    handleDownloadFromCloud,
    downloadingCloudKey,
    sharePresentationLocalId,
    closeSharePresentationModal,
    savedList,
    handleOpenSaved,
    cloudSyncConflict,
    dismissCloudSyncConflict,
    resolveCloudConflictUseRemote,
    resolveCloudConflictForceLocal,
  } = usePresentation();
  const { user: shareUser } = useAuth();
  const shareMeta =
    sharePresentationLocalId != null
      ? savedList.find((p) => p.id === sharePresentationLocalId)
      : undefined;
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
      <CloudPresentationsModal
        open={showCloudPresentationsModal}
        onClose={() => setShowCloudPresentationsModal(false)}
        items={cloudPresentationsItems}
        loading={cloudModalLoading}
        error={cloudModalError}
        sharedWarning={cloudSharedWarning}
        savedList={savedList}
        downloadingCloudKey={downloadingCloudKey}
        onDownload={handleDownloadFromCloud}
        onOpenLocal={handleOpenSaved}
      />
      <SharePresentationModal
        open={
          sharePresentationLocalId !== null &&
          !!shareMeta?.cloudId &&
          !!shareUser
        }
        onClose={closeSharePresentationModal}
        ownerUid={shareUser?.uid ?? ""}
        cloudId={shareMeta?.cloudId ?? ""}
        topic={shareMeta?.topic ?? ""}
      />
      <CloudSyncConflictModal
        open={cloudSyncConflict !== null}
        expectedRevision={cloudSyncConflict?.expectedRevision ?? 0}
        remoteRevision={cloudSyncConflict?.remoteRevision ?? 0}
        onDismiss={dismissCloudSyncConflict}
        onUseRemote={resolveCloudConflictUseRemote}
        onForceLocal={resolveCloudConflictForceLocal}
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
              onBackToWelcome={() => setSkipLogin(false)}
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
