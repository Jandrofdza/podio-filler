import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Export classifyInputs so server.js can use it
export async function classifyInputs(text) {
    const resp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `Eres un clasificador aduanal experto en comercio exterior mexicano.
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

Reglas:
- "nombre_corto" debe ser un título breve y claro del producto (ej. "Excavadora CAT 320GC", "Tubería de acero inoxidable 2 pulgadas"). Nunca uses el nombre del archivo.
- "descripcion" debe ser una explicación más extensa del producto.
- Si algún campo no aplica, escribe "N/A".
- Nunca omitas ni borres claves.`

            },
            {
                role: "user",
                content: `Clasifica el siguiente producto para aduanas:\n\n${text}`
            }
        ],
        response_format: { type: "json_object" }
    });

    try {
        return JSON.parse(resp.choices[0].message.content);
    } catch (err) {
        console.error("❌ Failed to parse GPT response:", err);
        return {
            nombre_corto: "N/A",
            descripcion: "N/A",
            fraccion: "N/A",
            justificacion: "N/A",
            alternativas: [],
            notas: "N/A",
            regulacion: "N/A",
            arbol: "N/A",
            dudas: "N/A"
        };
    }
}
