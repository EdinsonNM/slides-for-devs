import { type ReactNode } from "react";
import { LoadingScreen } from "../../../components/shared/LoadingScreen";
import { WelcomeSignInPanel } from "../../../components/home/WelcomeSignInPanel";
import { useAuth } from "@/presentation/contexts/AuthContext";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <WelcomeSignInPanel />;
  }

  return <>{children}</>;
}
