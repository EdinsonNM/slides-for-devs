import { Navigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

type RequireAuthProps = {
  children: React.ReactNode;
};

/**
 * Uso en rutas que deben asegurar sesión además de `AuthGate` (doble valla opcional).
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
