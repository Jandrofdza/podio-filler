// helpers/podio.js  (ESM)

export async function getPodioAppToken() {
  const { PODIO_APP_ID, PODIO_APP_TOKEN } = process.env;
  if (!PODIO_APP_ID || !PODIO_APP_TOKEN) throw new Error("Missing PODIO_APP_ID or PODIO_APP_TOKEN");

  const body = new URLSearchParams({ grant_type: "app", app_id: PODIO_APP_ID, app_token: PODIO_APP_TOKEN });
  const r = await fetch("https://api.podio.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Podio token error ${r.status}: ${JSON.stringify(j)}`);
  return j.access_token;
}

export async function listItemFiles(accessToken, itemId) {
  const r = await fetch(`https://api.podio.com/item/${itemId}/files`, {
    headers: { Authorization: `OAuth2 ${accessToken}` },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`List files error ${r.status}: ${JSON.stringify(j)}`);
  return Array.isArray(j) ? j : [];
}

export async function downloadFileBytes(accessToken, fileId) {
  const r = await fetch(`https://api.podio.com/file/${fileId}/download`, {
    headers: { Authorization: `OAuth2 ${accessToken}` },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Download error ${fileId} ${r.status}: ${t}`);
  }
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

/** Returns: [{ file_id, name, mimetype, size, bytes }, ...] */
export async function fetchPodioFiles(itemId) {
  const token = await getPodioAppToken();
  const metas = await listItemFiles(token, itemId);
  const out = [];
  for (const m of metas) {
    try {
      const bytes = await downloadFileBytes(token, m.file_id);
      out.push({ ...m, bytes });
    } catch (err) {
      console.error("download error", { file_id: m.file_id, err: String(err) });
    }
  }
  console.log("podio:files ok", { itemId, count: out.length });
  return out;
}
