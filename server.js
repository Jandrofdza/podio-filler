
import express from "express";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

app.post("/podio-hook", (req, res) => {
  console.log("=== Incoming /podio-hook request ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  // Send quick response to Supabase
  res.status(202).send("Received");

  // Simulate next steps (later: fetch Podio, GPT, update fields)
  const { item_id, req_id } = req.body || {};
  if (item_id) {
    console.log(`Processing item_id=${item_id}, req_id=${req_id}`);
    // TODO: download Podio file, run GPT, update Podio
  } else {
    console.warn("No item_id found in payload!");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Node filler running on http://localhost:${PORT}`);
});
// Render requires listening on PORT, not hardcoded 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node filler listening on port ${PORT}`);
});

