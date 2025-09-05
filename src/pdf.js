import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import mammoth from "mammoth";

// Extract text from PDF
export async function extractPdfText(buffer, { maxChars = 20000, maxPages = 3 } = {}) {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, isEvalSupported: false });
  const pdf = await loadingTask.promise;

  let text = "";
  const pages = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str).join(" ");
    text += strings + "\n";
    if (text.length > maxChars) break;
  }

  return text.slice(0, maxChars);
}

// Extract text from DOCX
export async function extractDocxText(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}
