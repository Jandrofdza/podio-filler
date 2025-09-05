import fs from "fs";
import { extractPdfText } from "./src/extractPdfText.js";  // adjust if extractPdfText.js lives elsewhere

const buffer = fs.readFileSync("./test.pdf");

extractPdfText(buffer, { maxChars: 5000, maxPages: 2 })
  .then((text) => console.log("✅ Extracted text:\n", text))
  .catch((err) => console.error("❌ Error extracting PDF:", err));
