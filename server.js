
import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

app.post("/podio-hook", (req, res) => {
  console.log("=== Incoming /podio-hook request ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  // Send quick response to Supabase
  res.status(202).send("Received");

  // Simulate next steps (later: fetch Podio, GPT, update fields)
  const { item_id, req_id } = req.body || {};
  if (item_id) {
    console.log(`Processing item_id=${item_id}, req_id=${req_id}`);
    // TODO: download Podio file, run GPT, update Podio

} else {
  console.warn("No item_id found in payload!");
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});


// --- FAST-ACK ROUTE (add once) ---
import express from "express";
import { fetchPodioFiles } from "./helpers/podio.js";

const app = globalThis.app || express();         // reuse if you already created it
app.use(express.json({ limit: "25mb" }));        // ensure JSON is parsed

app.post("/podio-hook", (req, res) => {
  const { item_id, req_id, event_type } = req.body || {};
  console.log("Incoming /podio-hook", { item_id, req_id, event_type, ts: new Date().toISOString() });
  res.status(202).json({ accepted: true });      // return immediately

  setImmediate(async () => {
    try { await processItem({ item_id, req_id, event_type }); }
    catch (err) { console.error("processItem error:", String(err)); }
  });
});

// --- Example processItem using the new helper ---
export async function processItem({ item_id }) {
  if (!item_id) throw new Error("Missing item_id");
  console.log("processItem: start", { item_id });

  // 🔽 Pull all files from Podio for this item
  const files = await fetchPodioFiles(item_id);

  // You now have Buffers in memory. Hand them to your AI & then update Podio.
  console.log("processItem: have files", files.map(f => ({
    file_id: f.file_id, name: f.name, size: f.size, mimetype: f.mimetype
  })));

  // TODO: your existing OpenAI + Podio field update logic here
  // e.g., await classifyAndUpdatePodio(item_id, files)

  console.log("processItem: done", { item_id, files: files.length });
}

// start server if not already started elsewhere
if (!globalThis.__serverStarted) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Filler listening on :${PORT}`));
  globalThis.__serverStarted = true;
}
globalThis.app = app;

