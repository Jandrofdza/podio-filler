import express from "express";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 10000;

// Parse both JSON and URL-encoded bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming /podio-hook request ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  const body = req.body || {};

  // Handle verification
  if (body.type === "hook.verify") {
    console.log("Responding to verify with code:", body.code);
    return res.status(200).send(body.code);
  }

  // Handle item.create
  if (body.type === "item.create") {
    console.log("Processing item.create for item_id:", body.item_id);

    // Forward to filler
    try {
      const resp = await fetch(`${process.env.NODES_URL}/podio-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: body.item_id,
          req_id: "auto"
        }),
      });

      if (!resp.ok) {
        console.error("Filler error:", resp.status, await resp.text());
        return res.status(500).send("Failed to call filler");
      }

      console.log("Forwarded successfully for item:", body.item_id);
    } catch (e) {
      console.error("Error forwarding to filler:", e);
      return res.status(500).send("Internal forward error");
    }
  }

  res.status(200).send("ok");
});

app.listen(PORT, () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
