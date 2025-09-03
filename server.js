import express from "express";
import { exec } from "child_process";

const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.NODEJS_SECRET}`) {
    return res.status(403).send("Forbidden");
  }

  const { itemId } = req.body;
  console.log("Webhook received for item:", itemId);

  exec(`node src/index.js run ${itemId}`, (error, stdout, stderr) => {
    if (error) {
      console.error("Error:", error);
      return res.status(500).send("CLI failed");
    }
    console.log("CLI output:", stdout);
    res.send("Processed successfully");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Podio CLI server running on port ${PORT}`));
