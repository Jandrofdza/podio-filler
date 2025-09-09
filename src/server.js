import express from "express";
import { fetchPodioFileBuffer } from "./fetchPodioFileBuffer.js";
import { classifyInputs } from "./openai.js"; // or classifyWithFiles if you add it
import { getPodioFiles } from "./podio.js";   // helper to list files from a Podio item

const app = express();
app.use(express.json()); // ✅ parse JSON bodies

// Health check
app.get("/healthz", (req, res) => {
  res.status(200).send("ok");
});

// Podio webhook handler
app.post("/podio-hook", async (req, res) => {
  console.log("📦 Incoming body:", req.body);

  const { item_id, req_id } = req.body || {};
  if (!item_id) {
    console.error("❌ Missing item_id in request body");
    return res.status(400).json({ error: "Missing item_id" });
  }

  try {
    console.log(`🔍 Processing Podio item: ${item_id}`);

    // Step 1. Get files attached to the item
    const files = await getPodioFiles(item_id);

    // Step 2. Download each file
    const buffers = [];
    for (const f of files) {
      const buf = await fetchPodioFileBuffer(f.file_id);
      if (buf) {
        buffers.push({ ...f, buffer: buf });
      }
    }

    // Step 3. Run classification (change classifyInputs -> classifyWithFiles if you add wrapper)
    const results = [];
    for (const f of buffers) {
      const text = f.buffer.toString("utf-8"); // simplification, PDFs may need extractPdfText
      const classification = await classifyInputs(text);
      results.push({ file: f.name, classification });
    }

    console.log("✅ Classification results:", results);

    res.json({ status: "ok", item_id, req_id, results });
  } catch (err) {
    console.error("❌ Error processing Podio hook:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

