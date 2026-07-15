import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { v4 as uuid } from "uuid";

ffmpeg.setFfmpegPath(ffmpegPath);

const FRAMES_PER_WINDOW = 8;
const WINDOW_SECONDS = 10;

/**
 * Probe a video for its duration (seconds).
 */
function getDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) return reject(err);
      resolve(data?.format?.duration || 0);
    });
  });
}

/**
 * Extract a single frame at a given timestamp (seconds) as a JPEG, return base64.
 */
function extractFrameAt(videoPath, timestampSec, outDir) {
  return new Promise((resolve, reject) => {
    const filename = `frame_${uuid()}.jpg`;
    const outPath = path.join(outDir, filename);
    ffmpeg(videoPath)
      .on("end", async () => {
        try {
          const buf = await fs.readFile(outPath);
          await fs.unlink(outPath).catch(() => {});
          resolve(buf.toString("base64"));
        } catch (e) {
          reject(e);
        }
      })
      .on("error", reject)
      .screenshots({
        timestamps: [timestampSec],
        filename,
        folder: outDir,
        size: "512x?",
      });
  });
}

/**
 * Splits a video into consecutive 10-second windows and extracts 8 evenly-spaced
 * frames (as base64 JPEG strings) per window.
 *
 * Returns: [{ windowIndex, startSec, endSec, frames: string[] }]
 */
export async function extractWindows(videoPath) {
  const duration = await getDuration(videoPath);
  if (!duration) throw new Error("Could not determine video duration");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "frames-"));
  const windows = [];

  try {
    const windowCount = Math.ceil(duration / WINDOW_SECONDS);

    for (let w = 0; w < windowCount; w++) {
      const startSec = w * WINDOW_SECONDS;
      const endSec = Math.min(startSec + WINDOW_SECONDS, duration);
      const windowLen = endSec - startSec;

      // Evenly space FRAMES_PER_WINDOW timestamps within this window
      const step = windowLen / FRAMES_PER_WINDOW;
      const timestamps = Array.from({ length: FRAMES_PER_WINDOW }, (_, i) =>
        Math.min(startSec + step * (i + 0.5), duration - 0.05)
      );

      // Extract sequentially to keep ffmpeg process count sane
      const frames = [];
      for (const ts of timestamps) {
        frames.push(await extractFrameAt(videoPath, ts, tmpDir));
      }

      windows.push({ windowIndex: w, startSec, endSec, frames });
    }

    return windows;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export const config = { FRAMES_PER_WINDOW, WINDOW_SECONDS };
