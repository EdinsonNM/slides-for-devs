import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

type RequireAuthProps = {
  children: React.ReactNode;
};

export function RequireAuth({ children }: RequireAuthProps) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}
