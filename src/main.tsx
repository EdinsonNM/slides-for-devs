import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { PresentationProvider } from "./context/PresentationContext";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <PresentationProvider>
        <App />
      </PresentationProvider>
    </HashRouter>
  </StrictMode>
);
