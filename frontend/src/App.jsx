import { useState } from "react";
import CameraCapture from "./components/CameraCapture.jsx";
import VideoUpload from "./components/VideoUpload.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";

export default function App() {
  const [mode, setMode] = useState("camera"); // "camera" | "upload"
  const [cameraResults, setCameraResults] = useState([]);
  const [uploadResults, setUploadResults] = useState([]);
  const [uploadMeta, setUploadMeta] = useState(null);
  const sessionStartRef = { current: null };

  function handleCameraResult(payload) {
    setCameraResults((prev) => {
      if (payload.status === "analyzing") {
        return [...prev, { status: "analyzing", timeLabel: new Date(payload.startedAt).toLocaleTimeString() }];
      }
      // replace the last "analyzing" placeholder with the real result
      const next = [...prev];
      const idx = next.findIndex((r) => r.status === "analyzing");
      const resolved = {
        status: payload.status,
        timeLabel: new Date(payload.startedAt).toLocaleTimeString(),
        classification: payload.classification,
        confidence: payload.confidence,
        reasoning: payload.reasoning || payload.message,
      };
      if (idx !== -1) next[idx] = resolved;
      else next.push(resolved);
      return next;
    });
  }

  function handleUploadResult(msg) {
    setUploadResults((prev) => {
      const next = [...prev];
      next[msg.windowIndex] = msg;
      return next;
    });
  }

  function resetUpload() {
    setUploadResults([]);
    setUploadMeta(null);
  }

  const activeResults = mode === "camera" ? cameraResults : uploadResults.filter(Boolean);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Situation Safety Analyzer</h1>
        <p className="subtitle">
          Classifies live camera feed or uploaded video into <strong>harmful</strong>, <strong>safe</strong>, or{" "}
          <strong>normal</strong> every 10 seconds, using 8 sampled frames per window.
        </p>
      </header>

      <div className="tabs">
        <button className={`tab ${mode === "camera" ? "active" : ""}`} onClick={() => setMode("camera")}>
          Live Camera
        </button>
        <button className={`tab ${mode === "upload" ? "active" : ""}`} onClick={() => setMode("upload")}>
          Upload Video
        </button>
      </div>

      <main className="panels">
        <section className="left-panel">
          {mode === "camera" ? (
            <CameraCapture onResult={handleCameraResult} />
          ) : (
            <VideoUpload onResult={handleUploadResult} onMeta={setUploadMeta} onReset={resetUpload} />
          )}
          {uploadMeta && (
            <p className="hint">
              {uploadMeta.windowCount} windows detected ({uploadMeta.config.FRAMES_PER_WINDOW} frames each)
            </p>
          )}
        </section>

        <section className="right-panel">
          <h2>Timeline</h2>
          <ResultsPanel results={activeResults} />
        </section>
      </main>
    </div>
  );
}
