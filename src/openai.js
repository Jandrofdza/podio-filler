import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function classifyWithFiles(files, prompt) {
  const fileIds = [];
  for (const f of files) {
    const resp = await openai.files.create({
      file: f.buffer,
      purpose: "assistants"
    });
    fileIds.push(resp.id);
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Eres un clasificador aduanal experto en comercio exterior mexicano. Devuelve JSON con campos de Podio." },
      { role: "user", content: prompt }
    ],
    file_ids: fileIds,
    response_format: { type: "json_object" }
  });

  return JSON.parse(completion.choices[0].message.content);
}
