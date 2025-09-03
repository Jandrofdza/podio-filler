import { extractPdfText } from './pdf.js';
import { classifyInputs } from './openai.js';
import { fetchFileBuffer } from './util.js';

export async function runItemFiles(files, cfg) {
  const imageInputs = [];
  const pdfTexts = [];

  for (const f of files) {
    const { type, url } = f;

    try {
      const buffer = await fetchFileBuffer(url);

      if (["image/jpeg", "image/png"].includes(type)) {
        console.log('  image detected:', f.name);
        imageInputs.push(url);

      } else if (type === "application/pdf") {
        console.log('  pdf-parse start');
        let text = "";
        try {
          text = await extractPdfText(buffer, { maxPages: 3, timeoutMs: 10000 });
        } catch (e) {
          console.warn('PDF parse failed:', e?.message || String(e));
        }
        console.log('  pdf-parse done', { chars: (text || '').length });
        if (text) pdfTexts.push(text);

      } else {
        console.log("Skipping unsupported file type:", type);
      }
    } catch (e) {
      console.error("Error fetching file:", f.name, e?.message || String(e));
    }
  }

  if (imageInputs.length === 0 && pdfTexts.length === 0) {
    console.log('No usable inputs (no images and PDF had no extractable text).');
    return;
  }

  const result = await classifyInputs(
    { imageUrls: imageInputs, texts: pdfTexts },
    cfg.openai.apiKey
  );

  console.log("Classification result:", result);
  return result;
}
