import React, { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { LoadingScreen } from "./components/shared/LoadingScreen";
import { useAppUpdaterCheck } from "./presentation/hooks/app/useAppUpdaterCheck";
import { AuthGate } from "./presentation/app/guards/AuthGate";
import { ApiConfigGate } from "./presentation/app/guards/ApiConfigGate";
import { GlobalPresentationModals } from "./presentation/app/GlobalPresentationModals";

const HomePage = lazy(() => import("./presentation/pages/home/HomePage"));
const EditorPage = lazy(() => import("./presentation/pages/editor/EditorPage"));
const ConfigureAiPage = lazy(() =>
  import("./presentation/pages/configure-ai/ConfigureAiPage"),
);
const PresenterPage = lazy(() => import("./presentation/pages/presenter/PresenterPage"));
const PublicPresentationPage = lazy(() =>
  import("./presentation/pages/public/PublicPresentationPage"),
);

export default function App() {
  useAppUpdaterCheck();
  return (
    <AuthGate>
      <ApiConfigGate>
        <GlobalPresentationModals />
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/mis-proyectos" element={<HomePage />} />
            <Route path="/editor" element={<EditorPage />} />
            <Route path="/editor/:presentationId" element={<EditorPage />} />
            <Route path="/configure-ai" element={<ConfigureAiPage />} />
            <Route path="/presenter" element={<PresenterPage />} />
            <Route
              path="/public/:ownerUid/:cloudId"
              element={<PublicPresentationPage />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ApiConfigGate>
    </AuthGate>
  );
}
