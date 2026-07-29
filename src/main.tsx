import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoaderCircle } from "lucide-react";
import App from "./App";
import { AuthGate } from "./components/AuthGate";
import { reloadOnFirstServiceWorkerControl } from "./lib/coopServiceWorker";
import { clearLegacyPublicDataCache } from "./lib/legacyDataCache";
import "./styles.css";

void clearLegacyPublicDataCache();

const waitingForSecureNavigation = import.meta.env.PROD
  && "serviceWorker" in navigator
  && reloadOnFirstServiceWorkerControl(
    navigator.serviceWorker,
    () => window.location.reload(),
  );

createRoot(document.getElementById("root")!).render(waitingForSecureNavigation
  ? <main className="state-screen"><div className="loader-mark"><LoaderCircle size={34} /><span>Preparando acesso seguro...</span></div></main>
  : (
      <StrictMode>
        <AuthGate>
          <App />
        </AuthGate>
      </StrictMode>
    ));
