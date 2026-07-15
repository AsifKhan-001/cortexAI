import "dotenv/config";
import express from "express";
import cors from "cors";
import analyzeRouter from "./routes/analyze.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" })); // room for 8 base64 frames per request

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.NVIDIA_API_KEY) });
});

app.use("/api/analyze", analyzeRouter);

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`Video safety analyzer backend listening on http://localhost:${port}`);
  if (!process.env.NVIDIA_API_KEY) {
    console.warn("WARNING: NVIDIA_API_KEY is not set. Copy .env.example to .env and add your key.");
  }
});
