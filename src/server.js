import express from "express";
import fetch from "node-fetch";
import { classifyWithFiles } from "./openai.js";

const app = express();
app.use(express.json());

const PODIO_TOKEN = process.env.PODIO_TOKEN;

async function getPodioFiles(itemId) {
  const resp = await fetch(`https://api.podio.com/item/${itemId}/files/`, {
    headers: { Authorization: `OAuth2 ${PODIO_TOKEN}` }
  });
  const data = await resp.json();
  return data.map(f => f.link);
}

async function fetchPodioFileBuffer(fileId) {
  const url = `https://api.podio.com/file/${fileId}/raw`;
  console.log("📂 Downloading from:", url);

  const resp = await fetch(url, {
    headers: { Authorization: `OAuth2 ${process.env.PODIO_TOKEN}` }
  });

  if (!resp.ok) {
    throw new Error(`Failed to download file ${fileId}: ${resp.status} ${resp.statusText}`);
  }

  return Buffer.from(await resp.arrayBuffer());
}


app.post("/podio-hook", async (req, res) => {
  try {
    const { item_id } = req.body;
    if (!item_id) return res.status(400).json({ error: "Missing item_id" });

    const fileLinks = await getPodioFiles(item_id);

    const files = [];
    for (const link of fileLinks) {
      const resp = await fetch(link, { headers: { Authorization: `OAuth2 ${PODIO_TOKEN}` } });
      const buffer = Buffer.from(await resp.arrayBuffer());
      files.push({ buffer, name: "podio-file" });
    }

    const prompt = "Clasifica este producto con fracción arancelaria TIGIE.";
    const result = await classifyWithFiles(files, prompt);

    // 🔥 Push result back to Podio
    await fetch(`https://api.podio.com/item/${item_id}`, {
      method: "PUT",
      headers: {
        Authorization: `OAuth2 ${PODIO_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fields: result })
    });

    console.log("✅ Updated Podio with:", result);
    res.json({ ok: true, result });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 10000, () =>
  console.log(`🚀 Server running on ${process.env.PORT || 10000}`)
);
