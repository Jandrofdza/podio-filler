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
Siempre devuelve JSON **válido** que siga exactamente este esquema:

{
  "nombre_corto": "string - nombre corto del producto",
  "descripcion": "string - descripción detallada del producto",
  "fraccion": "string - código HS de 8 dígitos",
  "justificacion": "string - justificación legal y técnica",
  "alternativas": ["opción1", "opción2"],
  "notas": "string - notas adicionales del clasificador",
  "regulacion": "string - regulación aplicable si la hay",
  "arbol": "string - estructura jerárquica de clasificación",
  "dudas": "string - dudas para el cliente"
}

⚠️ Si no hay información suficiente, escribe "N/A" en el campo, no lo dejes vacío ni omitas campos.`
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
