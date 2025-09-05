import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getPodioToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.PODIO_CLIENT_ID,
    client_secret: process.env.PODIO_CLIENT_SECRET,
  });

  const resp = await fetch("https://api.podio.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) throw new Error(`Podio token failed: ${await resp.text()}`);
  const j = await resp.json();
  return j.access_token;
}

app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming Podio webhook ===");
  console.log(req.body);

  res.status(200).send("ok"); // respond fast

  const itemId = req.body.item_id || req.body.item?.item_id;
  if (!itemId) {
    console.warn("No item_id in payload");
    return;
  }

  try {
    const token = await getPodioToken();
    const filesResp = await fetch(`https://api.podio.com/item/${itemId}/files`, {
      headers: { Authorization: `OAuth2 ${token}` },
    });
    const files = await filesResp.json();
    console.log("Files:", files);

    // Upload files to Supabase
    for (const f of files) {
      const raw = await fetch(`https://api.podio.com/file/${f.file_id}/raw`, {
        headers: { Authorization: `OAuth2 ${token}` },
      });
      const buf = Buffer.from(await raw.arrayBuffer());
      const path = `${itemId}/${f.name}`;

      const { error } = await sb.storage
        .from("podio")
        .upload(path, buf, { contentType: f.mimetype, upsert: true });
      if (error) throw error;

      console.log(`Uploaded ${f.name} to Supabase`);
    }

    // TODO: call GPT filler logic here
  } catch (e) {
    console.error("Error handling webhook:", e);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
