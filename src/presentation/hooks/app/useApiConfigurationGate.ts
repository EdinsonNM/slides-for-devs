import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePresentation } from "../../../presentation/contexts/PresentationContext";
import {
  hasAnyApiConfiguredAsync,
  hasAnyApiConfiguredSync,
} from "../../../services/apiConfig";
import { registerApiConfigurationRequiredListener } from "../../../services/apiConfigurationGate";

function initialApiConfiguredState(): boolean | null {
  if (typeof window === "undefined") return null;
  const isTauri = (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
  return isTauri ? null : hasAnyApiConfiguredSync();
}

export function useApiConfigurationGate(): {
  apiConfigured: boolean | null;
  onApiConfigureSaved: () => void;
  openApiConfigFromSettings: () => void;
} {
  const navigate = useNavigate();
  const { refreshApiKeys } = usePresentation();
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(initialApiConfiguredState);

  useEffect(() => {
    if (apiConfigured !== null) return;
    void hasAnyApiConfiguredAsync().then(setApiConfigured);
  }, [apiConfigured]);

  useEffect(() => {
    registerApiConfigurationRequiredListener(() => {
      navigate("/configure-ai?mode=settings&reason=generate");
    });
    return () => {
      registerApiConfigurationRequiredListener(null);
    };
  }, [navigate]);

  const onApiConfigureSaved = useCallback(() => {
    refreshApiKeys();
    setApiConfigured(hasAnyApiConfiguredSync());
  }, [refreshApiKeys]);

  const openApiConfigFromSettings = useCallback(() => {
    navigate("/configure-ai?mode=settings");
  }, [navigate]);

  return { apiConfigured, onApiConfigureSaved, openApiConfigFromSettings };
}
