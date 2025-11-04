import express from "express";
import crypto from "crypto";
import { fetchPodioFileBuffer } from "./fetchPodioFileBuffer.js";
import { classifyInputs } from "./openai.js";
import { getPodioFiles, setItemValues } from "./podio.js";
import { getPodioAccessToken } from "./podioAuth.js";
import { extractPdfText } from "./extractPdfText.js";

const PORT = process.env.PORT || 10000;
const SHARED = process.env.FILLER_SHARED_TOKEN || ""; // optional shared secret

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// small request id for logs
app.use((req, _res, next) => {
  req._rid = crypto.randomBytes(4).toString("hex");
  next();
});

function requireSharedToken(req, res, next) {
  if (!SHARED) return next();
  if (req.get("X-Worker-Token") === SHARED) return next();
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

function mapClassificationToPodioValues(first = {}) {
  const values = {};
  if (first.nombre_corto) values["titulo"] = first.nombre_corto;
  if (first.descripcion) values["descripcion-del-producto"] = first.descripcion;
  if (first.fraccion) values["fraccion-2"] = first.fraccion;
  if (first.justificacion) values["justificacion-legal"] = first.justificacion;

  if (Array.isArray(first.alternativas) && first.alternativas.length) {
    values["analisis"] = first.alternativas
      .map(a => (typeof a === "string" ? a : JSON.stringify(a)))
      .join("\n");
  } else if (first.alternativas) {
    values["analisis"] = String(first.alternativas);
  }

  if (Array.isArray(first.notas) && first.notas.length) {
    values["notas-del-clasificador"] = first.notas.join("\n");
  } else if (first.notas) {
    values["notas-del-clasificador"] = String(first.notas);
  }

  if (Array.isArray(first.dudas) && first.dudas.length) {
    values["dudas-para-el-cliente"] = first.dudas.join("\n");
  } else if (first.dudas) {
    values["dudas-para-el-cliente"] = String(first.dudas);
  }

  if (first.regulacion) values["regulacion"] = first.regulacion;
  if (first.arbol) values["arbol"] = first.arbol;
  return values;
}

async function classifyItemAndUpdate(item_id, token, rid = "") {
  console.log(`[${rid}] 🔍 Fetching files for item ${item_id}`);
  const files = await getPodioFiles(item_id, token);

  const buffers = [];
  for (const f of files) {
    try {
      const buf = await fetchPodioFileBuffer(f.file_id);
      if (buf) buffers.push({ ...f, buffer: buf });
    } catch (err) {
      console.error(`[${rid}] ⚠️ Failed to fetch file ${f.file_id}: ${err.message}`);
    }
  }

  const results = [];
  for (const f of buffers) {
    let text = "";
    try {
      if (f.name?.toLowerCase().endsWith(".pdf")) {
        console.log(`[${rid}] 📑 Extracting text from PDF: ${f.name}`);
        text = await extractPdfText(f.buffer, { maxChars: 20000, maxPages: 3 });
      } else {
        console.log(`[${rid}] 📄 Treating as text: ${f.name}`);
        text = f.buffer.toString("utf-8");
      }
      const snippet = text.slice(0, 8000);
      console.log(`[${rid}] ✉️  Sending ${snippet.length} chars to OpenAI`);
      const classification = await classifyInputs(snippet);
      results.push({ file: f.name, classification });
    } catch (err) {
      console.error(`[${rid}] ❌ classify failed for ${f.name}: ${err.message}`);
    }
  }

  if (results.length > 0) {
    const first = results[0].classification;
    const values = mapClassificationToPodioValues(first);
    console.log(`[${rid}] 📝 setItemValues →`, Object.keys(values));
    await setItemValues(item_id, values, token);
  } else {
    console.warn(`[${rid}] ⚠️ No classifiable files found`);
  }
  return results;
}

// friendly routes
app.get("/", (_req, res) =>
  res.json({ ok: true, service: "podio-filler", routes: ["GET /healthz", "POST /podio-hook", "POST /fill"] })
);
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Podio webhook (expects { item_id })
app.post("/podio-hook", requireSharedToken, async (req, res) => {
  const rid = req._rid;
  console.log(`[${rid}] ▶️  /podio-hook body:`, req.body);
  const { item_id, req_id } = req.body || {};
  if (!item_id) return res.status(400).json({ ok: false, error: "Missing item_id" });

  try {
    const token = await getPodioAccessToken();
    if (!token) return res.status(500).json({ ok: false, error: "No Podio token available" });

    const results = await classifyItemAndUpdate(item_id, token, rid);
    return res.json({ status: "ok", item_id, req_id, results });
  } catch (err) {
    console.error(`[${rid}] 💥 /podio-hook error:`, err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

// Alias:
// A) { podio_item_id } → behave like /podio-hook
// B) { podio_item_id, classification } → direct write (skip file fetch/LLM)
app.post("/fill", requireSharedToken, async (req, res) => {
  const rid = req._rid;
  try {
    const { podio_item_id, classification } = req.body || {};
    if (!podio_item_id) {
      return res.status(400).json({ ok: false, error: "podio_item_id required" });
    }

    const token = await getPodioAccessToken();
    if (!token) return res.status(500).json({ ok: false, error: "No Podio token available" });

    if (classification) {
      const values = mapClassificationToPodioValues(classification);
      console.log(`[${rid}] 📝 setItemValues (direct) →`, Object.keys(values));
      await setItemValues(podio_item_id, values, token);
      return res.json({ ok: true, mode: "direct", item_id: podio_item_id, wrote: Object.keys(values) });
    }

    const results = await classifyItemAndUpdate(podio_item_id, token, rid);
    return res.json({ ok: true, mode: "forward", item_id: podio_item_id, results });
  } catch (err) {
    console.error(`[${rid}] 💥 /fill error:`, err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on :${PORT}`);
});
