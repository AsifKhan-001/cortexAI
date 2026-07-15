import { Router } from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractWindows, config as frameConfig } from "../services/frameExtractor.js";
import { classifyFrameWindow } from "../services/nvidiaClient.js";

const router = Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 200) * 1024 * 1024 },
});

function nvidiaOpts() {
  return { apiKey: process.env.NVIDIA_API_KEY, model: process.env.NVIDIA_MODEL };
}

/**
 * POST /api/analyze/video
 * multipart/form-data with field "video"
 * Splits the video into 10s windows (8 frames each) and classifies every window.
 * Streams results back as newline-delimited JSON so the frontend can show progress
 * for long videos instead of waiting for the whole thing.
 */
router.post("/video", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No video file uploaded (field name: video)" });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");

  const tempPath = req.file.path;

  try {
    const windows = await extractWindows(tempPath);
    res.write(JSON.stringify({ type: "meta", windowCount: windows.length, config: frameConfig }) + "\n");

    for (const w of windows) {
      try {
        const result = await classifyFrameWindow(w.frames, nvidiaOpts());
        res.write(
          JSON.stringify({
            type: "result",
            windowIndex: w.windowIndex,
            startSec: w.startSec,
            endSec: w.endSec,
            ...result,
          }) + "\n"
        );
      } catch (err) {
        res.write(
          JSON.stringify({
            type: "result",
            windowIndex: w.windowIndex,
            startSec: w.startSec,
            endSec: w.endSec,
            classification: "error",
            reasoning: err.message,
          }) + "\n"
        );
      }
    }

    res.write(JSON.stringify({ type: "done" }) + "\n");
    res.end();
  } catch (err) {
    res.write(JSON.stringify({ type: "error", message: err.message }) + "\n");
    res.end();
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
});

/**
 * POST /api/analyze/frames
 * JSON body: { frames: string[] }  -- base64 JPEGs captured client-side from the camera,
 * one 10-second window's worth (ideally 8 frames).
 * Used for the live-camera flow: the frontend captures frames every ~1.25s and posts the
 * batch of 8 once per 10-second interval.
 */
router.post("/frames", async (req, res) => {
  const { frames } = req.body || {};
  if (!Array.isArray(frames) || frames.length === 0) {
    return res.status(400).json({ error: "Expected non-empty 'frames' array of base64 JPEGs" });
  }
  try {
    const result = await classifyFrameWindow(frames, nvidiaOpts());
    res.json({ type: "result", ...result });
  } catch (err) {
    res.status(500).json({ type: "error", message: err.message });
  }
});

export default router;
