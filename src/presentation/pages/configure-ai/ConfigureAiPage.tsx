import { Navigate, useSearchParams } from "react-router-dom";
import { ApiConfigurationScreen } from "../../../components/setup/ApiConfigurationScreen";
import { RequireAuth } from "@/presentation/app/guards/RequireAuth";
import { useAppApiConfig } from "@/presentation/app/ApiConfigContext";

function ConfigureAiScreen() {
  const { onApiConfigureSaved } = useAppApiConfig();
  const [searchParams] = useSearchParams();
  if (searchParams.get("mode") !== "settings") {
    const next = new URLSearchParams(searchParams);
    next.set("mode", "settings");
    const qs = next.toString();
    return (
      <Navigate
        to={{
          pathname: "/configure-ai",
          search: qs ? `?${qs}` : "?mode=settings",
        }}
        replace
      />
    );
  }
  return <ApiConfigurationScreen onSaved={onApiConfigureSaved} />;
}

export default function ConfigureAiPage() {
  return (
    <RequireAuth>
      <ConfigureAiScreen />
    </RequireAuth>
  );
}
