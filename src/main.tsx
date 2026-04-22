import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { PresentationProvider } from "./context/PresentationContext";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
  </StrictMode>
);
