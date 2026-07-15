import { useRef, useState } from "react";

export default function VideoUpload({ onResult, onMeta, onReset }) {
  const fileInputRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    onReset();
    setBusy(true);

    const formData = new FormData();
    formData.append("video", file);

    try {
      const res = await fetch("/api/analyze/video", { method: "POST", body: formData });
      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `Server responded ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete last line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          if (msg.type === "meta") onMeta(msg);
          else if (msg.type === "result") onResult(msg);
          else if (msg.type === "error") setError(msg.message);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="upload-panel">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFile}
        disabled={busy}
        id="video-upload-input"
      />
      <label htmlFor="video-upload-input" className="btn primary">
        {busy ? "Analyzing…" : "Choose a video file"}
      </label>
      {fileName && <span className="hint">{fileName}</span>}
      {error && <p className="error-text">{error}</p>}
      <p className="hint small">
        The video is split into consecutive 10-second windows; 8 evenly-spaced frames per window are sent to the
        model, one window at a time, and results stream in below as they finish.
      </p>
    </div>
  );
}
