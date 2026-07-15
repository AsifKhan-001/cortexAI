import { useEffect, useRef, useState } from "react";

const FRAMES_PER_WINDOW = 8;
const WINDOW_MS = 10_000;
const FRAME_INTERVAL_MS = WINDOW_MS / FRAMES_PER_WINDOW; // 1.25s

export default function CameraCapture({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const framesRef = useRef([]);
  const intervalRef = useRef(null);
  const streamRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
      beginWindowLoop();
    } catch (err) {
      setError("Could not access camera: " + err.message);
    }
  }

  function stopCamera() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    framesRef.current = [];
    setRunning(false);
    setCountdown(0);
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const w = 512;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 384;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    framesRef.current.push(dataUrl);
  }

  function beginWindowLoop() {
    let tick = 0;
    setCountdown(FRAMES_PER_WINDOW);
    intervalRef.current = setInterval(async () => {
      captureFrame();
      tick += 1;
      setCountdown(FRAMES_PER_WINDOW - (tick % FRAMES_PER_WINDOW || FRAMES_PER_WINDOW));

      if (tick % FRAMES_PER_WINDOW === 0) {
        const frames = framesRef.current;
        framesRef.current = [];
        const windowStart = new Date();
        onResult({ status: "analyzing", startedAt: windowStart });
        try {
          const res = await fetch("/api/analyze/frames", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ frames }),
          });
          const data = await res.json();
          onResult({ status: "done", startedAt: windowStart, ...data });
        } catch (err) {
          onResult({ status: "error", startedAt: windowStart, message: err.message });
        }
      }
    }, FRAME_INTERVAL_MS);
  }

  return (
    <div className="capture-panel">
      <video ref={videoRef} className="camera-preview" muted playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="capture-controls">
        {!running ? (
          <button className="btn primary" onClick={startCamera}>
            Start camera monitoring
          </button>
        ) : (
          <button className="btn danger" onClick={stopCamera}>
            Stop monitoring
          </button>
        )}
        {running && (
          <span className="hint">
            capturing frame {FRAMES_PER_WINDOW - countdown + 1}/{FRAMES_PER_WINDOW} of this 10s window
          </span>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
