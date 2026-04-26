import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FiberProvider } from "its-fine";
import { AuthProvider } from "./presentation/contexts/AuthContext";
import { ThemeProvider } from "./presentation/contexts/ThemeContext";
import { PresentationProvider } from "./presentation/contexts/PresentationContext";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FiberProvider>
      <HashRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <PresentationProvider>
                <App />
              </PresentationProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </HashRouter>
    </FiberProvider>
  </StrictMode>
);
