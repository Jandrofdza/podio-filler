import express from "express";
import { fetchPodioFileBuffer } from "./fetchPodioFileBuffer.js";
import { classifyInputs } from "./openai.js";
import { getPodioFiles, setItemValues } from "./podio.js";
import { getPodioAccessToken } from "./podioAuth.js";
import { extractPdfText } from "./extractPdfText.js";

const PORT = process.env.PORT || 10000;
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/healthz", (req, res) => {
    res.status(200).send("ok");
});

// Podio webhook
app.post("/podio-hook", async (req, res) => {
    console.log("📦 Incoming body:", req.body);

    const { item_id, req_id } = req.body || {};
    if (!item_id) {
        return res.status(400).json({ error: "Missing item_id" });
    }

    async function processItem(token) {
        // Step 1. Fetch files
        const files = await getPodioFiles(item_id, token);

        // Step 2. Download buffers
        const buffers = [];
        for (const f of files) {
            try {
                const buf = await fetchPodioFileBuffer(f.file_id);
                if (buf) {
                    buffers.push({ ...f, buffer: buf });
                }
            } catch (err) {
                console.error(`⚠️ Failed to fetch file ${f.file_id}:`, err.message);
            }
        }

        // Step 3. Classify each buffer
        const results = [];
        for (const f of buffers) {
            let text = "";

            if (f.name.toLowerCase().endsWith(".pdf")) {
                console.log(`📑 Extracting text from PDF: ${f.name}`);
                text = await extractPdfText(f.buffer, { maxChars: 20000, maxPages: 3 });
            } else {
                console.log(`📄 Treating as text: ${f.name}`);
                text = f.buffer.toString("utf-8");
            }

            const snippet = text.slice(0, 8000);
            console.log(`Sending ${snippet.length} chars to OpenAI (truncated)`);

            const classification = await classifyInputs(snippet);
            results.push({ file: f.name, classification });
        }

        console.log("✅ Classification results:", results);

        // Step 4. Map GPT → Podio external IDs
        if (results.length > 0) {
            const first = results[0].classification;
            const values = {};

            if (first.nombre_corto) values["titulo"] = first.nombre_corto;
            if (first.descripcion) values["descripcion-del-producto"] = first.descripcion;
            if (first.fraccion) values["fraccion-2"] = first.fraccion;
            if (first.justificacion) values["justificacion-legal"] = first.justificacion;
            if (first.alternativas?.length > 0) {
                values["analisis"] = Array.isArray(first.alternativas)
                    ? first.alternativas.join("\n")
                    : first.alternativas;
            }
            if (first.notas?.length > 0) {
                values["notas-del-clasificador"] = Array.isArray(first.notas)
                    ? first.notas.join("\n")
                    : first.notas;
            }
            if (first.dudas?.length > 0) {
                values["dudas-para-el-cliente"] = Array.isArray(first.dudas)
                    ? first.dudas.join("\n")
                    : first.dudas;
            }
            if (first.regulacion) values["regulacion"] = first.regulacion;
            if (first.arbol) values["arbol"] = first.arbol;

            try {
                await setItemValues(item_id, values, token);
                console.log("✅ Podio fields updated:", values);
            } catch (updateErr) {
                console.error("❌ Failed to update Podio fields:", updateErr.message);
            }
        }

        return results;
    }

    try {
        let token;
        try {
            token = await getPodioAccessToken();
            console.log("🔑 Using cached/valid token");
            const results = await processItem(token);
            return res.json({ status: "ok", item_id, req_id, results });
        } catch (firstErr) {
            console.warn("⚠️ First attempt failed, retrying with fresh token:", firstErr.message);
            token = await getPodioAccessToken(true); // force refresh
            const results = await processItem(token);
            return res.json({ status: "ok", item_id, req_id, results, retried: true });
        }
    } catch (err) {
        console.error("❌ Error processing Podio hook:", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
