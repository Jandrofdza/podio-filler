import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;

// Capture raw body
app.use((req, res, next) => {
  let data = "";
  req.on("data", chunk => { data += chunk });
  req.on("end", () => {
    req.rawBody = data;
    try {
      if (req.headers["content-type"]?.includes("application/json")) {
        req.body = JSON.parse(data || "{}");
      } else if (req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
        req.body = Object.fromEntries(new URLSearchParams(data));
      } else {
        req.body = {};
      }
    } catch (e) {
      console.error("❌ Failed to parse body:", e);
      req.body = {};
    }
    next();
  });
});

app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming Podio webhook ===");
  console.log("Headers:", req.headers);
  console.log("Raw body:", req.rawBody);
  console.log("Parsed body:", req.body);

  const body = req.body || {};

  if (body.type === "hook.verify") {
    console.log("✅ Verification challenge:", body.code);
    return res.status(200).send(body.code);
  }

  if (body.type === "item.create") {
    const itemId = body.item_id || null;
    if (!itemId) {
      console.error("❌ Missing item_id in payload");
      return res.status(400).send("Missing item_id");
    }
    console.log("✅ Processing item.create for item_id:", itemId);
    // forward to filler or further logic here
  }

  return res.status(200).send("ok");
});

app.listen(PORT, () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
