import express from "express";
import { fetchPodioFileBuffer } from "./fetchPodioFileBuffer.js";
import { classifyInputs } from "./openai.js";   // or classifyWithFiles if you later add it
import { getPodioFiles } from "./podio.js";     // wrapper we added in podio.js

const app = express();

// ✅ Parse both JSON and form-encoded bodies (Podio can send either)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

// Podio webhook route
app.post("/podio-hook", async (req, res) => {
  console.log("📦 Incoming body:", req.body);

  const { item_id, req_id } = req.body || {};
  if (!item_id) {
    console.error("❌ Missing item_id in request body");
    return res.status(400).json({ error: "Missing item_id" });
  }

  try {
    console.log(`🔍 Processing Podio item: ${item_id}`);

    // ✅ Explicitly grab token from env
    const token = process.env.PODIO_TOKEN;
    if (!token) {
      console.error("❌ PODIO_TOKEN is missing from environment!");
      return res.status(500).json({ error: "No Podio token available" });
    }
    console.log("🔑 PODIO_TOKEN loaded (first 10 chars):", token.slice(0, 10));

    // Step 1. Fetch files for the item
    const files = await getPodioFiles(item_id, token);

// Step 2. Download file buffers
const buffers = [];
for (const f of files) {
  try {
    const buf = await fetchPodioFileBuffer(f.file_id);
    if (buf) {
      buffers.push({ ...f, buffer: buf });
    }
  } catch (err) {
    console.error(`⚠️ Failed to fetch file ${f.file_id}:`, err.message);
  }
}

// Step 3. Classify each buffer
const results = [];
for (const f of buffers) {
  const text = f.buffer.toString("utf-8");

  // 🚨 truncate so GPT only gets the first 8000 characters
  const snippet = text.slice(0, 8000);
  console.log(`Sending ${snippet.length} chars to OpenAI (truncated)`);

  const classification = await classifyInputs(snippet);
  results.push({ file: f.name, classification });
}

console.log("✅ Classification results:", results);

res.json({ status: "ok", item_id, req_id, results });
} catch (err) {
  console.error("❌ Error processing Podio hook:", err);
  res.status(500).json({ error: err.message });
}
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

