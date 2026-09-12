import { useEffect, useState } from "react";

export interface LoadingStep {
  label: string;
  index: number;
  total: number;
}

interface LoadingProps {
  step?: LoadingStep;
  error?: string | null;
}

function Loading({ step, error }: LoadingProps) {
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer — restarts if the step label changes (so you can see how
  // long the *current* phase has been running, not just the total).
  useEffect(() => {
    if (error) return;
    setElapsed(0);
    const started = Date.now();
    const interval = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => window.clearInterval(interval);
  }, [error, step?.label]);

  const pct = step && step.total > 0
    ? Math.max(0, Math.min(100, Math.round((step.index / step.total) * 100)))
    : 0;

  return (
    <div className="loading-screen">
      <div className="loading-card">
        <img
          className="loading-logo"
          src="/LOGO.svg"
          alt="Open;Source"
        />
        <h1 className="loading-title">Open;Source Online Inventory</h1>

        {error ? (
          <>
            <div className="loading-error">⚠ {error}</div>
            <button
              className="loading-retry"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <div className="loading-bar-track">
              <div
                className="loading-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="loading-step">
              <span className="loading-step-label">
                {step?.label ?? "Starting…"}
              </span>
              <span className="loading-step-count">
                {step ? `${step.index} / ${step.total}` : ""}
              </span>
            </div>

            <div className="loading-elapsed">
              {elapsed}s on this step
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Loading;