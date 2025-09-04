import express from "express";
import fetch from "node-fetch"; // ensure installed
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

// ENV
const PODIO_BASE = "https://api.podio.com";
const APP_ID = process.env.PODIO_APP_ID;
const APP_TOKEN = process.env.PODIO_APP_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Podio token helper
async function getPodioToken() {
  const body = new URLSearchParams({
    grant_type: "app",
    app_id: APP_ID,
    app_token: APP_TOKEN
  });

  const resp = await fetch(`${PODIO_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!resp.ok) throw new Error(`Podio token error: ${await resp.text()}`);
  const data = await resp.json();
  return data.access_token;
}

// Fetch attached files from Podio
async function getPodioFiles(itemId, token) {
  const resp = await fetch(`${PODIO_BASE}/item/${itemId}`, {
    headers: { Authorization: `OAuth2 ${token}` }
  });
  if (!resp.ok) throw new Error(`Failed to fetch item ${itemId}: ${await resp.text()}`);
  const item = await resp.json();
  return item.files || [];
}

app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming /podio-hook request ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  const { item_id, req_id } = req.body;
  if (!item_id) {
    res.status(400).send("Missing item_id");
    return;
  }

  res.status(202).send("Received"); // ACK quickly

  try {
    const token = await getPodioToken();
    const files = await getPodioFiles(item_id, token);
    console.log(`Fetched ${files.length} files for item ${item_id}`);
    files.forEach(f => {
      console.log(`- File: ${f.name} (${f.link})`);
    });

    // TODO: download file(s), send to GPT, update Podio fields
  } catch (err) {
    console.error("Error handling item:", err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
