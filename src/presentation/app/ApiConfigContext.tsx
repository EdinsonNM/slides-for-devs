import { createContext, useContext, type ReactNode } from "react";

export type AppApiConfigValue = {
  onApiConfigureSaved: () => void;
  openApiConfigFromSettings: () => void;
};

const AppApiConfigContext = createContext<AppApiConfigValue | null>(null);

export function useAppApiConfig(): AppApiConfigValue {
  const v = useContext(AppApiConfigContext);
  if (!v) {
    throw new Error("useAppApiConfig must be used within ApiConfigGate");
  }
  return v;
}

export function AppApiConfigProvider({
  value,
  children,
}: {
  value: AppApiConfigValue;
  children: ReactNode;
}) {
  return (
    <AppApiConfigContext.Provider value={value}>
      {children}
    </AppApiConfigContext.Provider>
  );
}
