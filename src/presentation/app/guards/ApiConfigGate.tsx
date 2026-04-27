import { type ReactNode } from "react";
import { LoadingScreen } from "../../../components/shared/LoadingScreen";
import { useApiConfigurationGate } from "@/presentation/hooks/app/useApiConfigurationGate";
import { AppApiConfigProvider } from "../ApiConfigContext";

type ApiConfigGateProps = {
  children: ReactNode;
};

export function ApiConfigGate({ children }: ApiConfigGateProps) {
  const { apiConfigured, onApiConfigureSaved, openApiConfigFromSettings } =
    useApiConfigurationGate();

  if (apiConfigured === null) {
    return <LoadingScreen />;
  }

  return (
    <AppApiConfigProvider
      value={{ onApiConfigureSaved, openApiConfigFromSettings }}
    >
      {children}
    </AppApiConfigProvider>
  );
}
