import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PresentationProvider } from "./context/PresentationContext";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PresentationProvider>
      <App />
    </PresentationProvider>
  </StrictMode>
);
