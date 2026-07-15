const LABELS = {
  harmful: { text: "Harmful", className: "badge harmful" },
  safe: { text: "Safe", className: "badge safe" },
  normal: { text: "Normal", className: "badge normal" },
  unknown: { text: "Unclear", className: "badge unknown" },
  error: { text: "Error", className: "badge error" },
};

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ResultsPanel({ results }) {
  if (!results.length) {
    return <p className="hint">Results for each 10-second window will appear here.</p>;
  }

  return (
    <div className="results-list">
      {results.map((r, i) => {
        const label = LABELS[r.classification] || LABELS.unknown;
        const timeRange =
          typeof r.startSec === "number" ? `${formatTime(r.startSec)}–${formatTime(r.endSec)}` : r.timeLabel;

        return (
          <div className={`result-row ${r.status === "analyzing" ? "analyzing" : ""}`} key={i}>
            <span className="result-time">{timeRange}</span>
            {r.status === "analyzing" ? (
              <span className="badge pending">Analyzing…</span>
            ) : (
              <span className={label.className}>{label.text}</span>
            )}
            {typeof r.confidence === "number" && (
              <span className="result-confidence">{Math.round(r.confidence * 100)}%</span>
            )}
            {r.reasoning && <span className="result-reasoning">{r.reasoning}</span>}
          </div>
        );
      })}
    </div>
  );
}
