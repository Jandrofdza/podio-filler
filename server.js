import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

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

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Failed to get Podio token: ${txt}`);
  }

  const data = await resp.json();
  return data.access_token;
}

app.post("/podio-hook", async (req, res) => {
  console.log("=== Incoming /podio-hook request ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  res.status(202).send("Received");

  const { item_id, req_id } = req.body || {};
  if (item_id) {
    console.log(`Processing item_id=${item_id}, req_id=${req_id}`);

    try {
      const token = await getPodioToken();
      const filesResp = await fetch(`https://api.podio.com/item/${item_id}/files`, {
        headers: {
          Authorization: `OAuth2 ${token}`,
        },
      });
      const files = await filesResp.json();
      console.log("Files found:", files);
    } catch (err) {
      console.error("Error fetching files:", err);
    }
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});
