import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { applyDisplayDevice } from "./lib/displayDevice";
import { StoreProvider } from "./lib/store";
import "./index.css";

applyDisplayDevice();
document.body.dataset.appReady = "1";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <StoreProvider>
        <App />
      </StoreProvider>
    </AuthProvider>
  </StrictMode>,
);
