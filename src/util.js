import fetch from "node-fetch";

/**
 * Fetches a file from a URL and returns it as a Buffer.
 * Supports images and PDFs.
 */
export async function fetchFileBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
