import axios from "axios";

const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are a safety-monitoring vision assistant. You will be shown a sequence of frames \
sampled evenly across a short (~10 second) video window, in chronological order. Based on what is happening \
across the whole sequence (not just one frame), classify the overall situation into exactly one of these labels:

- "harmful": the frames show violence, physical danger, an accident, abuse, a weapon being used threateningly, \
a medical emergency, fire, or another situation that could cause harm to a person.
- "safe": the frames show a situation that might look unusual or draw attention but is not actually dangerous \
(e.g. someone exercising, playing a sport, cooking, minor clumsiness).
- "normal": ordinary, everyday activity with nothing noteworthy.

Respond with ONLY a compact JSON object, no markdown fences, no extra text, in exactly this shape:
{"classification":"harmful|safe|normal","confidence":0.0-1.0,"reasoning":"one short sentence"}`;

/**
 * Sends a set of base64-encoded JPEG frames (already stripped of the data URI prefix or not, both fine)
 * to the NVIDIA-hosted vision-language model and asks it to classify the 10s window they represent.
 *
 * @param {string[]} frameBase64List - array of base64 strings (JPEG)
 * @param {{apiKey: string, model: string}} opts
 * @returns {Promise<{classification: string, confidence: number, reasoning: string, raw: string}>}
 */
export async function classifyFrameWindow(frameBase64List, opts) {
  const { apiKey, model } = opts;
  if (!apiKey) throw new Error("Missing NVIDIA_API_KEY");
  if (!frameBase64List?.length) throw new Error("No frames provided");

  const imageContent = frameBase64List.map((b64) => {
    const dataUrl = b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
    return { type: "image_url", image_url: { url: dataUrl } };
  });

  const payload = {
    model: model || "google/gemma-3n-e4b-it",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Here are ${frameBase64List.length} frames sampled evenly across one 10-second window, in chronological order. Classify this window.`,
          },
          ...imageContent,
        ],
      },
    ],
    max_tokens: 300,
    temperature: 0.2,
    top_p: 0.7,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false,
  };

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const response = await axios.post(INVOKE_URL, payload, { headers, timeout: 60_000 });
  const text = response?.data?.choices?.[0]?.message?.content ?? "";

  return parseModelResponse(text);
}

function parseModelResponse(text) {
  // Strip markdown fences if the model adds them despite instructions
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    return { classification: "unknown", confidence: 0, reasoning: "Could not parse model response", raw: text };
  }
  try {
    const parsed = JSON.parse(match[0]);
    const classification = ["harmful", "safe", "normal"].includes(parsed.classification)
      ? parsed.classification
      : "unknown";
    return {
      classification,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      reasoning: parsed.reasoning || "",
      raw: text,
    };
  } catch {
    return { classification: "unknown", confidence: 0, reasoning: "Could not parse model response", raw: text };
  }
}
