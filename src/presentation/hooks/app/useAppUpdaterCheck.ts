import { useEffect } from "react";
import { checkForAppUpdates } from "../../../services/updater";

export function useAppUpdaterCheck(): void {
  useEffect(() => {
    const t = setTimeout(() => {
      checkForAppUpdates();
    }, 1500);
    return () => clearTimeout(t);
  }, []);
}
