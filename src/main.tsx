import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./tailwind.css";
import "./index.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
if (typeof window !== "undefined") (window as unknown as { L: typeof L }).L = L;
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root");

function showBootError(message: string, err?: unknown) {
  rootEl.innerHTML = `
    <div style="min-height: 100vh; background: #fef2f2; padding: 1.5rem; font-family: system-ui; color: #991b1b;">
      <h1 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">App failed to start</h1>
      <p style="margin-bottom: 0.5rem;">${message}</p>
      ${err instanceof Error && err.stack ? `<pre style="font-size: 0.75rem; overflow: auto; background: #fee2e2; padding: 0.75rem; border-radius: 0.5rem;">${err.stack}</pre>` : ""}
    </div>
  `;
}

try {
  const root = createRoot(rootEl);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  showBootError(message, err);
}
  