// server.js
import express from "express";
import { classifyInputsV2 } from "./openai-v2.js"; // ← del archivo que te pasé
// Node 18+ ya tiene fetch global. Si usas Node <18: npm i node-fetch y 'import fetch from "node-fetch";'

const PORT = process.env.PORT || 3000;
const PODIO_TOKEN = process.env.PODIO_TOKEN; // OAuth2 (app/user) con permisos para leer archivos y editar el ítem

if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️ Falta OPENAI_API_KEY");
}
if (!PODIO_TOKEN) {
    console.warn("⚠️ Falta PODIO_TOKEN");
}

const app = express();
app.use(express.json({ limit: "25mb" }));

/* ------------------------------- Utilidades Podio ------------------------------- */

async function podioJson(url, init = {}) {
    const resp = await fetch(url, {
        ...init,
        headers: {
            Authorization: `OAuth2 ${PODIO_TOKEN}`,
            "Content-Type": "application/json",
            ...(init.headers || {})
        }
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Podio ${init.method || "GET"} ${url} => ${resp.status} ${resp.statusText} :: ${text}`);
    }
    return resp.json();
}

async function podioRaw(url, init = {}) {
    const resp = await fetch(url, {
        ...init,
        headers: {
            Authorization: `OAuth2 ${PODIO_TOKEN}`,
            ...(init.headers || {})
        }
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Podio ${init.method || "GET"} ${url} => ${resp.status} ${resp.statusText} :: ${text}`);
    }
    return Buffer.from(await resp.arrayBuffer());
}

/** Lista archivos del ítem (id numérico de Podio) */
async function listItemFiles(itemId) {
    // https://developers.podio.com/doc/files
    // GET /item/{item_id}/files
    const url = `https://api.podio.com/item/${itemId}/files/`;
    const files = await podioJson(url);
    // Normaliza
    return files.map(f => ({
        file_id: f.file_id,
        name: f.name,
        mimetype: f.mimetype || f.mime_type || "",
        link: f.link
    }));
}

/** Descarga binario + vuelve a leer metadatos del archivo */
async function fetchFileBufferWithInfo(fileId) {
    // GET /file/{file_id}
    const meta = await podioJson(`https://api.podio.com/file/${fileId}`);
    // GET /file/{file_id}/raw
    const buffer = await podioRaw(`https://api.podio.com/file/${fileId}/raw`);
    return {
        filename: meta.name || `file-${fileId}`,
        mime: meta.mimetype || meta.mime_type || "application/octet-stream",
        buffer
    };
}

/* ---------------------------- Mapeo de salida a Podio --------------------------- */

// TODO: ajusta a tu forma real de actualizar un ítem (field_ids o external_ids)
async function updatePodioItemFields(itemId, data) {
    // EJEMPLO con "external_id" (reemplaza por tus keys reales)
    // Doc real: /item/{item_id}/value ó /item/{item_id} (según tu flujo)
    const payload = {
        // Si usas external_id setea así; si usas field_id, ajusta.
        fields: {
            nombre_corto: data.nombre_corto,
            descripcion: data.descripcion,
            fraccion: data.fraccion,
            justificacion: data.justificacion,
            alternativas: Array.isArray(data.alternativas) ? data.alternativas.join("\n") : String(data.alternativas),
            notas_clasificador: data.notas,
            regulacion: data.regulacion,
            arbol: data.arbol,
            dudas_cliente: data.dudas,
            fecha: new Date().toISOString().slice(0, 10)
        }
    };

    // 🔧 REEMPLAZA esta URL por tu endpoint real de actualización (tú ya lo tenías en tu filler).
    // Muchos flujos usan PUT /item/{item_id}; otros /item/{item_id}/value. Dejo POST como placeholder.
    const url = `https://api.podio.com/item/${itemId}`;
    const resp = await fetch(url, {
        method: "PUT", // o POST según tu implementación previa
        headers: {
            Authorization: `OAuth2 ${PODIO_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        console.error("❌ Falló updatePodioItemFields:", resp.status, t);
        // No lanzamos error duro para no romper el webhook; registra y sigue
    }
}

/* ------------------------------- Flujo principal ------------------------------- */

async function classifyPodioItem(itemId) {
    // 1) Trae archivos del ítem
    const metas = await listItemFiles(itemId);
    console.log(`📎 Ítem ${itemId} tiene ${metas.length} archivo(s)`);

    // 2) Descarga buffers
    const files = [];
    for (const m of metas) {
        try {
            const f = await fetchFileBufferWithInfo(m.file_id);
            files.push(f);
        } catch (e) {
            console.warn(`⚠️ No se pudo bajar archivo ${m.file_id}:`, e.message);
        }
    }

    // 3) Clasifica (sin texto; sólo evidencias). Si no hay archivos, igual pasa vacío (forzará “Se requiere más información”).
    const result = await classifyInputsV2({
        text: "", // o puedes pasar una descripción que tengas en Podio
        files
    });

    console.log("🧾 Resultado v2:", result);

    // 4) (Opcional) Escribe a Podio
    await updatePodioItemFields(itemId, result);

    return result;
}

/* ---------------------------------- Rutas API ---------------------------------- */

// Health
app.get("/healthz", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Debug: listar archivos
app.get("/debug/item-files", async (req, res) => {
    try {
        const itemId = req.query.item_id;
        if (!itemId) return res.status(400).json({ ok: false, error: "Falta item_id" });
        const files = await listItemFiles(itemId);
        res.json({ ok: true, count: files.length, files });
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

// Debug: clasificar con base64 (cliente manda archivos)
app.post("/debug/classify-v2", async (req, res) => {
    try {
        const { text = "", files = [] } = req.body;
        const norm = (files || []).map(f => ({
            filename: f.filename,
            mime: f.mime,
            buffer: Buffer.from(f.base64, "base64")
        }));
        const result = await classifyInputsV2({ text, files: norm });
        res.json({ ok: true, result });
    } catch (e) {
        console.error(e);
        res.status(500).json({ ok: false, error: String(e) });
    }
});

// Webhook desde Podio (envía { item_id, req_id? })
app.post("/podio-hook", async (req, res) => {
    const { item_id } = req.body || {};
    if (!item_id) return res.status(400).json({ ok: false, error: "Falta item_id" });
    try {
        const result = await classifyPodioItem(item_id);
        res.json({ ok: true, item_id, result });
    } catch (e) {
        console.error("❌ /podio-hook error:", e);
        res.status(500).json({ ok: false, error: String(e) });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Node filler v2 on http://localhost:${PORT}`);
});
