import express from "express";

const app = express();
app.use(express.json());

// --- Function to fetch a Podio token using App Auth ---
async function getPodioToken() {
  const res = await fetch("https://api.podio.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "app",
      app_id: process.env.PODIO_APP_ID,
      app_token: process.env.PODIO_APP_TOKEN,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to get Podio token: ${txt}`);
  }
  const data = await res.json();
  return data.access_token;
}

// --- Main handler ---
app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming /podio-hook request ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  res.status(202).send("Received");

  const { item_id, req_id } = req.body || {};
  if (!item_id) {
    console.warn("No item_id found in payload!");
    return;
  }

  try {
    console.log(`Processing item_id=${item_id}, req_id=${req_id}`);
    const token = await getPodioToken();

    const filesResp = await fetch(`https://api.podio.com/item/${item_id}/files`, {
      headers: { Authorization: `OAuth2 ${token}` },
    });
    const files = await filesResp.json();
    console.log("Files for item:", item_id, files);
  } catch (err) {
    console.error("Error handling item:", err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
