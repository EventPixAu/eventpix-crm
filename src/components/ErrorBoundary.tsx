import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  title?: string;
  backTo?: string;
};

type State = {
  error: Error | null;
};

/**
 * Simple React error boundary to prevent hard crashes (blank screens).
 * Keeps errors visible to the user and logs details to console.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    const { error } = this.state;
    const { children, title = "Something went wrong", backTo = "/" } = this.props;

    if (!error) return children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">
              The page hit an unexpected error. You can go back, or copy the error details.
            </p>
          </div>

          <pre className="text-xs bg-muted text-foreground rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>

          <div className="flex flex-wrap gap-2">
            <Link to={backTo}>
              <Button variant="outline">Back</Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${error.message}${error.stack ? `\n\n${error.stack}` : ""}`
                  );
                } catch {
                  // no-op
                }
              }}
            >
              Copy error
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
