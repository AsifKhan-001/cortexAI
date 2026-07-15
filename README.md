# Situation Safety Analyzer

Full-stack app that classifies a scene as **harmful**, **safe**, or **normal**, once every
10-second window, using 8 sampled frames per window sent to an NVIDIA-hosted vision-language
model (`google/gemma-3n-e4b-it` by default).

Two input modes:
- **Live camera** — captures a frame roughly every 1.25s from your webcam, batches 8 of them,
  and posts the batch to the backend every 10 seconds.
- **Upload a video** — the backend splits the file into consecutive 10-second windows with
  `ffmpeg`, pulls 8 evenly-spaced frames per window, and streams a classification back for each
  window as it finishes (so long videos show progress instead of one big wait).

> **Note on the categories:** your original request said "harmful, serve, normal" — I've built
> this around **harmful / safe / normal**, assuming "serve" was a typo for "safe". If you meant
> something else, it's a one-line change in `backend/services/nvidiaClient.js` (the `SYSTEM_PROMPT`
> constant) plus the `LABELS` map in `frontend/src/components/ResultsPanel.jsx`.

## Prerequisites

- Node.js 18+
- `ffmpeg` is bundled via the `ffmpeg-static` npm package, so you don't need it installed separately.
- An NVIDIA API key from [build.nvidia.com](https://build.nvidia.com) (starts with `nvapi-`).

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# edit .env and paste your NVIDIA_API_KEY
npm start
```

The backend listens on `http://localhost:8787` by default. Check `http://localhost:8787/api/health`
to confirm it's up and that it sees your API key.

## 2. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The dev server proxies `/api/*`
requests to the backend on port 8787 (see `vite.config.js`), so no CORS setup is needed in dev.

## How classification works

For every 10-second window, the backend sends all frames from that window in a single chat
completion request (`type: image_url` content blocks) with a system prompt asking the model to
return strict JSON:

```json
{"classification": "harmful|safe|normal", "confidence": 0.0-1.0, "reasoning": "one short sentence"}
```

The backend parses that JSON and forwards a clean result to the frontend. If the model ever
returns something unparsable, the window is marked `unknown` rather than silently guessing.

## Endpoints

- `POST /api/analyze/video` — multipart form upload, field name `video`. Streams newline-delimited
  JSON, one line per window, as each window finishes analysis.
- `POST /api/analyze/frames` — JSON body `{ "frames": ["<base64 jpeg>", ...] }` (ideally 8 frames).
  Used by the live-camera flow; returns a single classification for that batch.

## Known limitations / things to tune before production use

- **Frame extraction is sequential** (one ffmpeg call per frame). Fine for demos; for long videos
  you'll want to batch-extract frames in a single ffmpeg pass (e.g. `fps` filter) for speed.
- **No auth/rate limiting** on the backend — add before exposing it publicly, since every request
  costs NVIDIA API credits.
- **Confidence/label drift**: vision-language models can misjudge ambiguous scenes. Treat this as
  a first-pass triage signal, not a certified safety system — add a human-review step for anything
  flagged `harmful` before acting on it.
- The 512px-wide frame downscale keeps base64 payloads small; raise it in `frameExtractor.js` /
  `CameraCapture.jsx` if you need more visual detail at the cost of larger requests.
