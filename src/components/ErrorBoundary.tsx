import React, { Component, ErrorInfo, ReactNode } from "react";

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
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

