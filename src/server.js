import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming Podio webhook ===");
  console.log(req.body);

  const body = req.body;

  if (!body) {
    console.error("No body received");
    return res.status(400).send("Missing body");
  }

  // Handle webhook verification
  if (body.type === "hook.verify") {
    console.log("Verification code:", body.code);
    return res.status(200).send(body.code);
  }

  // Handle item.create
  if (body.type === "item.create") {
    console.log("Processing item.create for:", body.item_id);
    // Forwarding or additional logic goes here
  }

  return res.status(200).send("ok");
});

app.listen(PORT, () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
