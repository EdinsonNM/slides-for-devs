import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { checkForAppUpdates } from "../../../services/updater";
import { HomeScreen } from "../../../components/home/HomeScreen";
import { usePresentation } from "../../../context/PresentationContext";
import { useAppApiConfig } from "../../app/ApiConfigContext";

/**
 * Rutas /home y /mis-proyectos: redirige al editor si ya hay diapositivas.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const tab: "inicio" | "proyectos" =
    location.pathname === "/mis-proyectos" ? "proyectos" : "inicio";
  const { openApiConfigFromSettings } = useAppApiConfig();
  const {
    slides,
    handleOpenSaved,
    handleGenerate,
    createBlankPresentation,
    currentSavedId,
  } = usePresentation();

  if (slides.length > 0) {
    return (
      <Navigate
        to={{
          pathname: currentSavedId ? `/editor/${currentSavedId}` : "/editor",
          search: location.search,
        }}
        replace
      />
    );
  }

  const onOpenSavedAndGo = async (id: string) => {
    await handleOpenSaved(id);
    navigate(`/editor/${id}`);
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
      activeTab={tab}
      onTabChange={(nextTab) => {
        navigate(nextTab === "inicio" ? "/home" : "/mis-proyectos");
      }}
      onOpenConfig={openApiConfigFromSettings}
      onCheckUpdates={() => {
        void checkForAppUpdates(false);
      }}
      onOpenSaved={onOpenSavedAndGo}
      onGenerate={onGenerateAndGo}
      onCreateBlank={onCreateBlankAndGo}
    />
  );
}
