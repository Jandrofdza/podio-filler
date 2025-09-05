import express from "express";
import fetch from "node-fetch";
import { extractPdfText, extractDocxText } from "././src/pdf.js";

import { classifyInputs } from "./src/openai.js";

const PODIO_TOKEN = process.env.PODIO_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

async function fetchPodioItem(itemId) {
  const resp = await fetch(`https://api.podio.com/item/${itemId}`, {
    headers: { Authorization: `OAuth2 ${PODIO_TOKEN}` },
  });
  console.log("📥 File fetch response:", resp.status, resp.statusText);
  if (!resp.ok) throw new Error(`Failed to fetch Podio item: ${resp.status}`);
  return await resp.json();
}

async function fetchPodioFileBuffer(fileId) {
  const resp = await fetch(`https://api.podio.com/file/${fileId}/download`, {
    headers: { Authorization: `OAuth2 ${PODIO_TOKEN}` },
  });
  console.log("📥 File fetch response:", resp.status, resp.statusText);
  if (!resp.ok) throw new Error(`Failed to download file ${fileId}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function updatePodioItem(itemId, data) {
  const body = {
    fields: {
      titulo: data.nombre_corto || "",
      "descripcion-del-producto": data.descripcion || "",
      fecha: data.fecha ? { start: data.fecha, end: data.fecha } : null,
      "fraccion-2": data.fraccion || "",
      "justificacion-legal": data.justificacion || "",
      arbol: (data.arbol || []).join(" > "),
      analisis: (data.alternativas || []).map(a => `${a.fraccion}: ${a.motivo}`).join(" | "),
      "dudas-para-el-cliente": data.dudas_cliente || "",
      regulacion: data.regulacion || "",
      "notas-del-clasificador": data.notas_clasificador || "",
    },
  };

  const resp = await fetch(`https://api.podio.com/item/${itemId}/value`, {
    method: "PUT",
    headers: {
      Authorization: `OAuth2 ${PODIO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  console.log("📥 File fetch response:", resp.status, resp.statusText);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to update Podio item: ${resp.status} ${errText}`);
  }

  return await resp.json();
}

async function processItem(itemId) {
  console.log("🔎 Processing item:", itemId);
  const item = await fetchPodioItem(itemId);

  const files = item.files || [];
  const imageUrls = [];
  const texts = [];

  for (const f of files) {
    if (f.mimetype.includes("image")) {
      console.log("🖼️ Skipping image:", f.name);
    } else if (f.mimetype.includes("pdf")) {
      const pdfBuffer = await fetchPodioFileBuffer(f.file_id);
      const parsed = await pdf(pdfBuffer); // ✅ Only buffer here
      texts.push(parsed.text);
      console.log("📄 Extracted PDF text (300 chars):", parsed.text.slice(0, 300));
    }
  }

  const result = await classifyInputs({ imageUrls, texts }, OPENAI_API_KEY);
  console.log("✅ GPT result:", result);

  await updatePodioItem(itemId, result);
  console.log("📌 Podio item updated:", itemId);
}

app.post("/podio-hook", async (req, res) => {
  const body = req.body;

  if (body.type === "hook.verify") {
    console.log("🔑 Verification code:", body.code, "for hook:", body.hook_id);
    return res.json({ status: "ok" });
  }

  if (body.type === "item.create") {
    const itemId = body.item_id;
    console.log("🆕 New Podio item:", itemId);
    processItem(itemId).catch(err => console.error("❌ Error:", err));
    return res.json({ status: "queued", itemId });
  }

  res.json({ status: "ignored" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🚀 Server listening on port " + PORT));
