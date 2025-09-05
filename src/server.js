import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 10000;

// Setup Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Capture raw body for debugging
app.use(bodyParser.json({ type: "application/json" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.text({ type: "*/*" }));

app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming Podio webhook ===");
  console.log("Headers:", req.headers);
  console.log("Raw body:", req.body);

  let body = {};
  try {
    if (typeof req.body === "string") {
      body = JSON.parse(req.body);
    } else {
      body = req.body;
    }
  } catch (e) {
    console.error("⚠️ Failed to parse body as JSON, falling back:", e);
    body = req.body || {};
  }

  console.log("Parsed body:", body);

  // Handle Podio verification
  if (body.type === "hook.verify") {
    console.log("Responding with verification code:", body.code);
    return res.status(200).send(body.code);
  }

  // Handle Podio item.create
  if (body.type === "item.create") {
    const itemId = body.item_id;
    console.log("Processing item.create for item_id:", itemId);

    if (!itemId) {
      console.error("❌ No item_id in payload:", body);
      return res.status(400).send("Missing item_id");
    }

    const { error } = await supabase.from("podio_events").insert({
      item_id: itemId,
      payload: body,
      created_at: new Date(),
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).send("Failed to insert into Supabase");
    }

    console.log("✅ Saved item_id to Supabase:", itemId);
  }

  res.status(200).send("ok");
});

app.listen(PORT, () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
