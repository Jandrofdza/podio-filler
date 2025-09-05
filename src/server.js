import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Middleware: capture raw body always
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
    } catch (err) {
      console.error("❌ Body parse error:", err);
      req.body = {};
    }
    next();
  });
});

app.post("/podio-hook", (req, res) => {
  console.log("=== Incoming Podio webhook ===");
  console.log("Headers:", req.headers);
  console.log("Raw body:", req.rawBody);
  console.log("Parsed body:", req.body);

  const type = req.body?.type;
  const itemId = req.body?.item_id;

  if (type === "hook.verify") {
    console.log("✅ Verification challenge:", req.body.code);
    return res.status(200).send(req.body.code);
  }

  if (type === "item.create") {
    if (!itemId) {
      console.error("❌ Missing item_id, payload was:", req.body);
      return res.status(400).send("Missing item_id");
    }
    console.log("✅ Processing item.create for item_id:", itemId);
  }

  return res.status(200).send("ok");
});

app.listen(PORT, () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
