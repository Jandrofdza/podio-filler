import express from "express";
import fetch from "node-fetch";
import { classifyInputs } from "./src/openai.js";

const PODIO_TOKEN = process.env.PODIO_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper: fetch Podio item + attachments
async function fetchPodioItem(itemId) {
  const resp = await fetch(`https://api.podio.com/item/${itemId}`, {
    headers: { Authorization: `OAuth2 ${PODIO_TOKEN}` },
  });
  if (!resp.ok) throw new Error(`Failed to fetch Podio item: ${resp.status}`);
  return await resp.json();
}

// Helper: fetch file download URL from Podio
async function fetchPodioFile(fileId) {
  const urlResp = await fetch(`https://api.podio.com/file/${fileId}`, {
    headers: { Authorization: `OAuth2 ${PODIO_TOKEN}` },
  });
  const fileMeta = await urlResp.json();
  return fileMeta.link;
}

// Process an item
async function processItem(itemId) {
  console.log("🔎 Processing item:", itemId);

  // 1. Fetch Podio item
  const item = await fetchPodioItem(itemId);

  // 2. Collect attachments
  const files = item.files || [];
  const imageUrls = [];
  const texts = [];

  for (const f of files) {
    const downloadUrl = await fetchPodioFile(f.file_id);
    if (f.mimetype.includes("image")) {
      imageUrls.push(downloadUrl);
    } else if (f.mimetype.includes("pdf")) {
      texts.push("PDF file: " + downloadUrl);
    }
  }

  // 3. Run GPT classifier
  const result = await classifyInputs({ imageUrls, texts }, OPENAI_API_KEY);

  console.log("✅ GPT result:", result);

  // 4. TODO: update Podio fields with result
  // (depends on your field external_ids)
}

// Webhook endpoint
app.post("/podio-hook", async (req, res) => {
  const body = req.body;

  if (body.type === "hook.verify") {
    console.log("🔑 Verification code:", body.code, "for hook:", body.hook_id);
    return res.json({ status: "ok" });
  }

  if (body.type === "item.create") {
    const itemId = body.item_id;
    console.log("🆕 New Podio item:", itemId);

    // Fire and forget — don’t block webhook response
    processItem(itemId).catch((err) => console.error("❌ Error:", err));

    return res.json({ status: "queued", itemId });
  }

  res.json({ status: "ignored" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(\`🚀 Server listening on port \${PORT}\`));
