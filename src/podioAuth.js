import fetch from "node-fetch";

let cachedToken = null;
let tokenExpiry = 0;

export async function getPodioAccessToken() {
  const now = Math.floor(Date.now() / 1000);

  // If cached token is still valid, reuse it
  if (cachedToken && now < tokenExpiry - 60) {
    return cachedToken;
  }

  console.log("🔄 Refreshing Podio access token...");

  const resp = await fetch("https://api.podio.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.PODIO_CLIENT_ID,
      client_secret: process.env.PODIO_CLIENT_SECRET,
      refresh_token: process.env.PODIO_REFRESH_TOKEN,
    })
  });

  if (!resp.ok) {
    throw new Error(`Failed to refresh Podio token: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();

  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in;

  console.log(`✅ Got new Podio token (valid for ${data.expires_in} seconds)`);

  return cachedToken;
}

