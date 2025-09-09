import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Export classifyInputs so server.js can use it
export async function classifyInputs(text) {
  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Eres un clasificador aduanal experto en comercio exterior mexicano. Devuelve JSON con fracción, justificación, alternativas, notas, dudas, etc." },
      { role: "user", content: text }

    ],
    response_format: { type: "json_object" },
  });

  try {
    return JSON.parse(resp.choices[0].message.content);
  } catch (err) {
    console.error("❌ Failed to parse GPT response:", err);
    return { error: "Invalid GPT output" };
  }
}
