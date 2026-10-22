import type { EngineState } from "./engine";

export function AnalysisPanel({
  name,
  state,
  enabled,
  onToggle,
  formatPv,
  showBestMove,
  onShowBestMoveChange,
}: {
  name: string;
  state: EngineState;
  enabled: boolean;
  onToggle: () => void;
  formatPv: (moves: string[]) => string;
  showBestMove: boolean;
  onShowBestMoveChange: (show: boolean) => void;
}) {
  return (
    <div className="web-panel">
      <div className="web-section-header">
        <h2>{name}</h2>
        <div className="web-analysis-controls">
          {enabled && state.status !== "error" && (
            <label className="web-best-move-toggle">
              <input
                type="checkbox"
                role="switch"
                checked={showBestMove}
                onChange={(event) => onShowBestMoveChange(event.target.checked)}
              />
              Best move
            </label>
          )}
          <button className={enabled ? "primary" : ""} onClick={onToggle}>
            {enabled && state.status !== "error" ? "Stop analysis" : "Analyze"}
          </button>
        </div>
      </div>
      <p className="web-muted">
        {enabled
          ? state.status === "loading"
            ? "Preparing the engine…"
            : state.status === "searching"
              ? "Analyzing on your device…"
              : "Analysis ready"
          : "Analysis runs on your device."}
      </p>
      {state.error && <p role="alert">{state.error}</p>}
      {enabled &&
        state.lines.map((line) => (
          <div className="web-engine-line" key={line.multipv}>
            <strong>{line.score}</strong>
            <small>Depth {line.depth}</small>
            <span>{formatPv(line.pv)}</span>
          </div>
        ))}
    </div>
  );
}
