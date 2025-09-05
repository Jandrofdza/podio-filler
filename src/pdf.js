import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfText(buffer, { maxChars = 20000, maxPages = 3 } = {}) {
  let data;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(buffer)) {
    data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else if (buffer instanceof Uint8Array) {
    data = buffer;
  } else {
    data = new Uint8Array(buffer);
  }

  const loadingTask = getDocument({ data, isEvalSupported: false });
  const pdf = await loadingTask.promise;

  let text = "";
  const pageCount = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += pageText + "\n";
    if (text.length >= maxChars) break;
  }

  return text.slice(0, maxChars);
}

