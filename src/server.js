import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming Podio webhook ===");
  console.log("Body:", req.body);

  const { item_id, req_id } = req.body || {};

  if (!item_id) {
    console.warn("⚠️ Missing item_id in request body");
    return res.status(400).json({ error: "Missing item_id" });
  }

  try {
    console.log(`Processing item_id=${item_id}, req_id=${req_id || "none"}`);

    // 👉 Place GPT/Podio field-filling logic here
    // Example:
    // await processPodioItem(item_id);

    res.json({ status: "ok", item_id });
  } catch (err) {
    console.error("❌ Error handling Podio item:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});


// 🔽 Helper: fetch Podio file links for a given item
async function getPodioFiles(itemId) {
  const resp = await fetch(`https://api.podio.com/item/${itemId}/files/`, {
    headers: { Authorization: `OAuth2 ${PODIO_TOKEN}` },
  });
  if (!resp.ok) throw new Error(`Podio files fetch failed: ${resp.status}`);
  const files = await resp.json();
  return files.map(f => f.link);
}
