import React, { Component, ErrorInfo, ReactNode } from "react";
import { atlasBugReportMailto } from "../utils/checkInAuth";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
          style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
        >
          <div
            className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full"
            style={{ background: "#fff", borderRadius: "0.5rem", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)", padding: "1.5rem", maxWidth: "42rem", width: "100%" }}
          >
            <h1 className="text-2xl font-bold text-red-600 mb-4" style={{ fontSize: "1.5rem", fontWeight: 700, color: "#dc2626", marginBottom: "1rem" }}>
              Something went wrong
            </h1>
            <p className="text-gray-700 mb-4" style={{ color: "#374151", marginBottom: "1rem" }}>
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-gray-600 mb-2">
                Error details
              </summary>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
                {this.state.error?.stack}
              </pre>
            </details>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                style={{ padding: "0.5rem 1rem", background: "#2563eb", color: "#fff", borderRadius: "0.375rem", border: "none" }}
              >
                Reload Page
              </button>
              <a
                href={atlasBugReportMailto({
                  error: this.state.error
                    ? `${this.state.error.message}\n${this.state.error.stack || ""}`
                    : undefined,
                })}
                className="px-4 py-2 rounded border border-gray-300 text-gray-800 hover:bg-gray-50"
                style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", color: "#1f2937", textDecoration: "none" }}
              >
                Email our team
              </a>
            </div>
            <p className="mt-3 text-sm text-gray-500" style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
              This looks like a bug. A short note about what you were doing helps us fix it.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

