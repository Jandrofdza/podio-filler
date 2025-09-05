import http from "http";

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  console.log("=== Incoming Podio webhook ===");
  console.log("Headers:", req.headers);

  let data = "";
  req.on("data", chunk => {
    data += chunk;
  });

  req.on("end", () => {
    console.log("Raw body:", data);

    let body = {};
    try {
      body = JSON.parse(data);
    } catch {
      try {
        body = Object.fromEntries(new URLSearchParams(data));
      } catch {
        body = { raw: data };
      }
    }

    console.log("Parsed body:", body);

    if (body.type === "hook.verify") {
      console.log("✅ Verification challenge:", body.code);
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(body.code);
    }

    if (body.type === "item.create") {
      const itemId = body.item_id;
      if (!itemId) {
        console.error("❌ Missing item_id, payload was:", body);
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Missing item_id");
      }
      console.log("✅ Processing item.create for item_id:", itemId);
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Raw HTTP server listening on port ${PORT}`);
});
