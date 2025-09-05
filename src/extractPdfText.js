import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function extractPdfText(buffer, { maxChars = 20000, maxPages = 3 } = {}) {
  let data;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
    data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else if (buffer instanceof Uint8Array) {
    data = buffer;
  } else {
    data = new Uint8Array(buffer);
  }

  const loadingTask = getDocument({ data, isEvalSupported: false });
  const pdf = await loadingTask.promise;

  let text = '';
  const totalPages = Math.min(pdf.numPages, maxPages);
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    text += content.items.map((i) => i.str).join(' ') + '\n';
    if (text.length >= maxChars) break;
  }

  return text.slice(0, maxChars);
}
