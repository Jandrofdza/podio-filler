import OpenAI from "openai";
import pdfParse from "pdf-parse";
import { fromBuffer as pdf2picFromBuffer } from "pdf2pic";
import { fileTypeFromBuffer } from "file-type";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function bufferToDataUrl(buf, mimeGuess = "application/octet-stream") {
    const ft = await fileTypeFromBuffer(buf).catch(() => null);
    const mime = ft?.mime || mimeGuess;
    const b64 = buf.toString("base64");
    return `data:${mime};base64,${b64}`;
}

async function extractFromPdfBuffer(pdfBuffer, { maxPages = 3 } = {}) {
    const out = { text: "", imagesDataUrls: [] };

    // 1) Texto si el PDF es digital
    try {
        const parsed = await pdfParse(pdfBuffer);
        out.text = (parsed.text || "").trim();
    } catch { /* PDF escaneado o sin texto embebido */ }

    // 2) Rasterizar primeras páginas a PNG (para visión)
    try {
        const converter = pdf2picFromBuffer(pdfBuffer, {
            density: 144, format: "png", width: 1280, height: 1280, preserveAspectRatio: true
        });
        for (let i = 1; i <= maxPages; i++) {
            const res = await converter(i, { responseType: "base64" });
            if (res?.base64) out.imagesDataUrls.push(`data:image/png;base64,${res.base64}`);
        }
    } catch { /* si falla, seguiremos con lo disponible */ }

    return out;
}

// v2: acepta texto + archivos (buffers) y cumple reglas de “sin N/A”
export async function classifyInputsV2({ text = "", files = [] }) {
    const SYSTEM = `
Eres un clasificador aduanal experto en comercio exterior mexicano.
Debes devolver SIEMPRE un JSON válido con exactamente estas claves:
{
  "nombre_corto": "string",
  "descripcion": "string",
  "fraccion": "string",
  "justificacion": "string",
  "alternativas": ["string"],
  "notas": "string",
  "regulacion": "string",
  "arbol": "string",
  "dudas": "string"
}

Reglas v2:
- Analizas IMÁGENES y PDFs, incluso si el PDF no tiene texto (usa lo que se vea).
- Nunca uses "N/A", "NA", null o vacío. Si falta información, escribe "Pendiente — ..." y especifica exactamente qué falta.
- Si la evidencia es insuficiente para una clasificación de calidad, el campo "nombre_corto" DEBE ser exactamente: "Se requiere más información".
- Si un campo requiere datos faltantes, añádelos también en la MISMA LÍNEA como "(Falta: material, uso, medidas, etc.)".
- "notas" debe listar de forma accionable qué datos/fotos/documentos se requieren para afinar la clasificación (ej.: material exacto, marca/modelo, medidas, placa de datos, uso previsto, país de origen).
- "alternativas" debe contener al menos 1 opción si hay ambigüedad (explica brevemente la razón de cada alternativa).
- Español claro, técnico y conciso.
`;

    // Construimos contenido multimodal
    const content = [];
    const userIntro = [
        "Clasifica el siguiente producto para aduanas.",
        text?.trim() ? `Descripción textual proporcionada:\n${text.trim()}` : "No se proporcionó descripción textual.",
        "Analiza los archivos adjuntos (imágenes/PDF)."
    ].join("\n\n");
    content.push({ type: "text", text: userIntro });

    // Adjuntar archivos (imágenes y/o PDFs → imágenes)
    for (const f of files) {
        const mime = (await fileTypeFromBuffer(f.buffer).catch(() => null))?.mime || f.mime || "";
        if (mime.startsWith("image/")) {
            const url = await bufferToDataUrl(f.buffer, mime);
            content.push({ type: "image_url", image_url: { url } });
        } else if (mime === "application/pdf" || f.filename?.toLowerCase().endsWith(".pdf")) {
            const { text: pdfText, imagesDataUrls } = await extractFromPdfBuffer(f.buffer);
            if (pdfText) content.push({ type: "text", text: `Texto extraído del PDF:\n${pdfText.slice(0, 4000)}` });
            if (imagesDataUrls.length) {
                for (const url of imagesDataUrls) content.push({ type: "image_url", image_url: { url } });
            } else {
                // Último recurso: pasa el PDF crudo como referencia
                const url = await bufferToDataUrl(f.buffer, "application/pdf");
                content.push({ type: "text", text: "PDF sin texto y sin rasterización disponible. Adjuntado como base64 para referencia." });
                content.push({ type: "image_url", image_url: { url } });
            }
        } else {
            const url = await bufferToDataUrl(f.buffer, mime || "application/octet-stream");
            content.push({ type: "text", text: `Archivo adjunto: ${f.filename || "(sin nombre)"}` });
            content.push({ type: "image_url", image_url: { url } });
        }
    }

    const resp = await client.chat.completions.create({
        model: "gpt-4o",               // usa gpt-4o-mini si prefieres menor costo
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content }
        ]
    });

    let out;
    try {
        out = JSON.parse(resp.choices?.[0]?.message?.content || "{}");
    } catch {
        out = {};
    }

    // Post-proceso “sin N/A” y mínimos razonables
    const ensure = (val, fallback) => {
        const s = (val ?? "").toString().trim();
        if (!s || /^n\/?a$/i.test(s)) return fallback;
        return s;
    };
    const faltasGen = "(Falta: material, uso previsto, medidas, marca/modelo, país de origen)";

    out.nombre_corto = ensure(
        out.nombre_corto,
        "Se requiere más información"
    );
    out.descripcion = ensure(
        out.descripcion,
        `Pendiente — descripción insuficiente ${faltasGen}`
    );
    out.fraccion = ensure(
        out.fraccion,
        `Pendiente — determinar capítulo/subpartida ${faltasGen}`
    );
    out.justificacion = ensure(
        out.justificacion,
        `Pendiente — explica criterio técnico (material/función/notas legales) ${faltasGen}`
    );
    if (!Array.isArray(out.alternativas) || out.alternativas.length === 0) {
        out.alternativas = [
            "Pendiente — sugerir alternativas una vez confirmado material/uso"
        ];
    } else {
        out.alternativas = out.alternativas.map(x =>
            ensure(x, "Pendiente — alternativa sin fundamento (Falta: criterio)")
        );
    }
    out.notas = ensure(
        out.notas,
        [
            "Proveer fotos nítidas de etiqueta/placa de datos",
            "Material exacto (p. ej., ABS, acero inox 304)",
            "Medidas (L×A×H) y peso",
            "Uso previsto y entorno",
            "Marca y modelo; país de origen"
        ].join("; ")
    );
    out.regulacion = ensure(
        out.regulacion,
        `Pendiente — validar si aplica NOM/COFEPRIS/SEMARNAT/SEDENA según producto ${faltasGen}`
    );
    out.arbol = ensure(
        out.arbol,
        `Pendiente — árbol tentativo (Capítulo > Partida > Subpartida) ${faltasGen}`
    );
    out.dudas = ensure(
        out.dudas,
        "¿Material exacto? ¿Uso previsto? ¿Medidas y peso? ¿Marca/modelo? ¿País de origen?"
    );

    // Devuelve SOLO las claves solicitadas (sin N/A)
    return {
        nombre_corto: out.nombre_corto,
        descripcion: out.descripcion,
        fraccion: out.fraccion,
        justificacion: out.justificacion,
        alternativas: out.alternativas,
        notas: out.notas,
        regulacion: out.regulacion,
        arbol: out.arbol,
        dudas: out.dudas
    };
}

// Compatibilidad: si tu server actual llama classifyInputs(text), mantenlo.
export async function classifyInputs(text) {
    return classifyInputsV2({ text, files: [] });
}
