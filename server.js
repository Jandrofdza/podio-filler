import express from "express";

const app = express();

// Podio sends x-www-form-urlencoded, so we must parse it
app.use(express.urlencoded({ extended: true }));
// Also parse JSON just in case
app.use(express.json());

app.post("/podio-hook", async (req, res) => {
  const body = req.body;
  console.log("=== Incoming webhook ===", body);

  // 1. Podio handshake
  if (body.type === "hook.verify") {
    console.log("🔑 Verification code:", body.code, "for hook:", body.hook_id);
    return res.json({ status: "ok" });
  }

  // 2. New Podio item
  if (body.type === "item.create") {
    const itemId = body.item_id;
    console.log("🆕 New item from Podio:", itemId);

    // 👉 Call your GPT filler logic here
    // await processItem(itemId);

    return res.json({ status: "queued", itemId });
  }

  // 3. Other event types
  res.json({ status: "ignored" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
