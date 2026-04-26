import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { EditorSlideUrlSync } from "../../../components/layout/EditorSlideUrlSync";
import { usePresentation } from "../../contexts/PresentationContext";
import { LoadingScreen } from "../../../components/shared/LoadingScreen";
import { EditorShell } from "../../../components/layout/EditorShell";
import { SavedListModal } from "../../../components/modals/SavedListModal";
import { CharacterCreatorModal } from "../../../components/modals/CharacterCreatorModal";
import { ImageGenerationModal } from "../../../components/modals/ImageGenerationModal";
import { ImageUploadModal } from "../../../components/modals/ImageUploadModal";
import { CodeGenerationModal } from "../../../components/modals/CodeGenerationModal";
import { VideoUrlModal } from "../../../components/modals/VideoUrlModal";
import { IframeEmbedUrlModal } from "../../../components/modals/IframeEmbedUrlModal";
import { ExportDeckVideoModal } from "../../../components/modals/ExportDeckVideoModal";
import { SplitSlideModal } from "../../../components/modals/SplitSlideModal";
import { RewriteSlideModal } from "../../../components/modals/RewriteSlideModal";
import { SpeechModal } from "../../../components/modals/SpeechModal";
import { GenerateFullDeckModal } from "../../../components/modals/GenerateFullDeckModal";
import { GenerateSlideContentModal } from "../../../components/modals/GenerateSlideContentModal";
import { PreviewOverlay } from "../../../components/preview/PreviewOverlay";
import { useAppApiConfig } from "../../app/ApiConfigContext";

function EditorLayout() {
  const { openApiConfigFromSettings } = useAppApiConfig();

  return (
    <>
      <EditorSlideUrlSync />
      <EditorShell onOpenConfig={openApiConfigFromSettings} />
      <SavedListModal />
      <CharacterCreatorModal />
      <ImageGenerationModal />
      <ImageUploadModal />
      <CodeGenerationModal />
      <VideoUrlModal />
      <IframeEmbedUrlModal />
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

function EditorRestoringRoute() {
  const { slides, restoreLastOpenedPresentation, handleOpenSaved, currentSavedId } =
    usePresentation();
  const [restoring, setRestoring] = useState(true);
  const triedRestore = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { presentationId } = useParams<{ presentationId: string }>();

  useEffect(() => {
    if (triedRestore.current) return;
    triedRestore.current = true;

    if (presentationId) {
      void handleOpenSaved(presentationId)
        .then(() => {
          setRestoring(false);
        })
        .catch(() => {
          setRestoring(false);
          navigate("/", { replace: true });
        });
      return;
    }

    void restoreLastOpenedPresentation()
      .then((ok) => {
        setRestoring(false);
        if (!ok && slides.length === 0) navigate("/", { replace: true });
      })
      .catch(() => {
        setRestoring(false);
        if (slides.length === 0) navigate("/", { replace: true });
      });
  }, [
    presentationId,
    handleOpenSaved,
    restoreLastOpenedPresentation,
    navigate,
    slides.length,
  ]);

  useEffect(() => {
    if (restoring) return;
    if (!currentSavedId) return;
    if (presentationId === currentSavedId) return;
    navigate(
      { pathname: `/editor/${currentSavedId}`, search: location.search },
      { replace: true },
    );
  }, [restoring, currentSavedId, presentationId, navigate, location.search]);

  if (restoring) return <LoadingScreen />;
  if (slides.length === 0) return <Navigate to="/" replace />;
  return <EditorLayout />;
}

export default function EditorPage() {
  return <EditorRestoringRoute />;
}
