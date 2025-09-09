import fetch from "node-fetch";
import { getPodioAccessToken } from "./podioAuth.js";

/**
 * Download a Podio file as Buffer.
 * - Checks file metadata before fetching /raw
 * - Retries if file is still processing
 * - Logs Podio 404 body for diagnostics
 * - Skips gracefully if file is missing
 */
export async function fetchPodioFileBuffer(fileId, maxRetries = 3) {
  const token = await getPodioAccessToken();
  const metaUrl = `https://api.podio.com/file/${fileId}`;
  const rawUrl = `https://api.podio.com/file/${fileId}/raw`;

  console.log("📂 Downloading from:", rawUrl);

  // Step 1: Confirm file exists
  const metaResp = await fetch(metaUrl, {
    headers: { Authorization: `OAuth2 ${token}` }
  });

  if (metaResp.status === 404) {
    console.warn(`⚠️ Podio file ${fileId} not found (metadata 404)`);
    return null;
  }

  if (!metaResp.ok) {
    throw new Error(`Failed to fetch file metadata ${fileId}: ${metaResp.status} ${metaResp.statusText}`);
  }

  // Step 2: Try to download raw content with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const resp = await fetch(rawUrl, {
      headers: { Authorization: `OAuth2 ${token}` }
    });

    if (resp.ok) {
      return Buffer.from(await resp.arrayBuffer());
    }

    if (resp.status === 404) {
      // Try to extract Podio error details
      let errorText = "";
      try {
        errorText = await resp.text();
      } catch (e) {
        errorText = "(no body)";
      }
      console.warn(`⏳ File ${fileId} 404 on attempt ${attempt}/${maxRetries}. Podio says: ${errorText}`);

      // Backoff before retry
      await new Promise(r => setTimeout(r, 2000 * attempt));
      continue;
    }

    throw new Error(`Failed to download file ${fileId}: ${resp.status} ${resp.statusText}`);
  }

  console.warn(`⚠️ File ${fileId} could not be downloaded after ${maxRetries} attempts (skipping).`);
  return null;
}

