import { useState, useEffect, useRef, useCallback } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { usePresentation } from "./context/PresentationContext";
import {
  hasAnyApiConfiguredSync,
  hasAnyApiConfiguredAsync,
} from "./services/apiConfig";
import { registerApiConfigurationRequiredListener } from "./services/apiConfigurationGate";
import { checkForAppUpdates } from "./services/updater";
import { LoadingScreen } from "./components/shared/LoadingScreen";
import { EditorShell } from "./components/layout/EditorShell";
import { HomeScreen } from "./components/home/HomeScreen";
import { WelcomeSignInPanel } from "./components/home/WelcomeSignInPanel";
import { useAuth } from "./context/AuthContext";
import { SavedListModal } from "./components/modals/SavedListModal";
import { SharePresentationModal } from "./components/modals/SharePresentationModal";
import { CloudSyncConflictModal } from "./components/modals/CloudSyncConflictModal";
import { DeletePresentationModal } from "./components/modals/DeletePresentationModal";
import { ImageGenerationModal } from "./components/modals/ImageGenerationModal";
import { ImageUploadModal } from "./components/modals/ImageUploadModal";
import { CodeGenerationModal } from "./components/modals/CodeGenerationModal";
import { VideoUrlModal } from "./components/modals/VideoUrlModal";
import { ExportDeckVideoModal } from "./components/modals/ExportDeckVideoModal";
import { SplitSlideModal } from "./components/modals/SplitSlideModal";
import { RewriteSlideModal } from "./components/modals/RewriteSlideModal";
import { SpeechModal } from "./components/modals/SpeechModal";
import { CharacterCreatorModal } from "./components/modals/CharacterCreatorModal";
import { PreviewOverlay } from "./components/preview/PreviewOverlay";
import { PresenterView } from "./components/presenter/PresenterView";
import { GeneratingPresentationModal } from "./components/modals/GeneratingPresentationModal";
import { GenerateFullDeckModal } from "./components/modals/GenerateFullDeckModal";
import { GenerateSlideContentModal } from "./components/modals/GenerateSlideContentModal";
import { ApiConfigurationScreen } from "./components/setup/ApiConfigurationScreen";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

interface HomeOrRedirectProps {
  onOpenConfig: () => void;
  apiConfigured: boolean;
}

function HomeOrRedirect({ onOpenConfig, apiConfigured }: HomeOrRedirectProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    slides,
    handleOpenSaved,
    handleGenerate,
    createBlankPresentation,
  } = usePresentation();

  if (slides.length > 0) {
    return <Navigate to="/editor" replace />;
  }

  if (!user) {
    return <WelcomeSignInPanel />;
  }

  if (!apiConfigured) {
    return <Navigate to="/configure-ai" replace />;
  }

  const onOpenSavedAndGo = async (id: string) => {
    await handleOpenSaved(id);
    navigate("/editor");
  };

  const onGenerateAndGo = (e: React.FormEvent) => {
    const ok = handleGenerate(e);
    if (!ok) return;
    navigate("/editor");
  };

  const onCreateBlankAndGo = async () => {
    await createBlankPresentation();
    navigate("/editor");
  };

  return (
    <HomeScreen
      onOpenConfig={onOpenConfig}
      onCheckUpdates={() => checkForAppUpdates(false)}
      onOpenSaved={onOpenSavedAndGo}
      onGenerate={onGenerateAndGo}
      onCreateBlank={onCreateBlankAndGo}
    />
  );
}

interface EditorLayoutProps {
  onOpenConfig: () => void;
}

function EditorLayout({ onOpenConfig }: EditorLayoutProps) {
  return (
    <>
      <EditorShell onOpenConfig={onOpenConfig} />
      <SavedListModal />
      <CharacterCreatorModal />
      <ImageGenerationModal />
      <ImageUploadModal />
      <CodeGenerationModal />
      <VideoUrlModal />
      <ExportDeckVideoModal />
      <SplitSlideModal />
      <RewriteSlideModal />
      <SpeechModal />
      <GenerateFullDeckModal />
      <GenerateSlideContentModal />
      <PreviewOverlay />
    </>
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
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const {
    refreshApiKeys,
    pendingGeneration,
    sharePresentationLocalId,
    closeSharePresentationModal,
    savedList,
    cloudSyncAvailable,
    deletePresentationTarget,
    closeDeletePresentationModal,
    confirmDeletePresentationLocalOnly,
    confirmClearPresentationLocalKeepCloud,
    confirmDeletePresentationLocalAndCloud,
    cloudSyncConflict,
    dismissCloudSyncConflict,
    resolveCloudConflictUseRemote,
    resolveCloudConflictForceLocal,
  } = usePresentation();
  const isLoggedIn = !!user;
  const shareMeta =
    sharePresentationLocalId != null
      ? savedList.find((p) => p.id === sharePresentationLocalId)
      : undefined;
  /** null = cargando (solo en Tauri), true = configurado, false = sin configurar */
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(() =>
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ === undefined
      ? hasAnyApiConfiguredSync()
      : null,
  );

  const isPresenterWindow = location.pathname === "/presenter";

  useEffect(() => {
    if (apiConfigured !== null) return;
    hasAnyApiConfiguredAsync().then(setApiConfigured);
  }, [apiConfigured]);

  useEffect(() => {
    registerApiConfigurationRequiredListener(() => {
      navigate("/configure-ai?reason=generate");
    });
    return () => registerApiConfigurationRequiredListener(null);
  }, [navigate]);

  const handleApiConfigureSaved = useCallback(() => {
    refreshApiKeys();
    setApiConfigured(hasAnyApiConfiguredSync());
  }, [refreshApiKeys]);

  const openApiConfigFromSettings = useCallback(() => {
    navigate("/configure-ai?mode=settings");
  }, [navigate]);

  useEffect(() => {
    const t = setTimeout(() => {
      checkForAppUpdates();
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <WelcomeSignInPanel />;
  }

  if (isPresenterWindow) {
    return <PresenterView />;
  }

  if (apiConfigured === null) {
    return <LoadingScreen />;
  }

  return (
    <>
      <GeneratingPresentationModal isOpen={pendingGeneration !== null} />
      <SharePresentationModal
        open={
          sharePresentationLocalId !== null &&
          !!shareMeta?.cloudId &&
          !!user
        }
        onClose={closeSharePresentationModal}
        ownerUid={user?.uid ?? ""}
        cloudId={shareMeta?.cloudId ?? ""}
        topic={shareMeta?.topic ?? ""}
      />
      <CloudSyncConflictModal
        open={cloudSyncConflict !== null}
        expectedRevision={cloudSyncConflict?.expectedRevision ?? 0}
        remoteRevision={cloudSyncConflict?.remoteRevision ?? 0}
        localSlideCount={cloudSyncConflict?.localSlideCount}
        remoteSlideCount={cloudSyncConflict?.remoteSlideCount}
        onDismiss={dismissCloudSyncConflict}
        onUseRemote={resolveCloudConflictUseRemote}
        onForceLocal={resolveCloudConflictForceLocal}
      />
      <DeletePresentationModal
        open={deletePresentationTarget !== null}
        meta={deletePresentationTarget}
        cloudSyncAvailable={cloudSyncAvailable}
        isLoggedIn={isLoggedIn}
        onClose={closeDeletePresentationModal}
        onDeleteLocalOnly={confirmDeletePresentationLocalOnly}
        onClearLocalKeepCloud={confirmClearPresentationLocalKeepCloud}
        onDeleteLocalAndCloud={confirmDeletePresentationLocalAndCloud}
      />
      <Routes>
        <Route
          path="/configure-ai"
          element={
            <RequireAuth>
              <ApiConfigurationScreen onSaved={handleApiConfigureSaved} />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <HomeOrRedirect
              onOpenConfig={openApiConfigFromSettings}
              apiConfigured={apiConfigured}
            />
          }
        />
        <Route
          path="/editor"
          element={
            <EditorRoute onOpenConfig={openApiConfigFromSettings} />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
