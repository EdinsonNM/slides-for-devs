import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { PresentationProvider } from "./context/PresentationContext";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <PresentationProvider>
            <App />
          </PresentationProvider>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>
);
