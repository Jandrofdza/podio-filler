import fetch from "node-fetch";

let cachedToken = null;
let tokenExpiry = 0;

export async function getPodioAccessToken(forceRefresh = false) {
    const now = Math.floor(Date.now() / 1000);

    // ✅ Return cached token if valid and not forcing refresh
    if (!forceRefresh && cachedToken && now < tokenExpiry) {
        return cachedToken;
    }

    console.log("🔄 Refreshing Podio token...");

    const resp = await fetch("https://api.podio.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: process.env.PODIO_CLIENT_ID,
            client_secret: process.env.PODIO_CLIENT_SECRET,
            refresh_token: process.env.PODIO_REFRESH_TOKEN
        })
    });

    if (!resp.ok) {
        throw new Error(`Podio token refresh failed: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in || 3600) - 60; // refresh 1 min early

    console.log("✅ Got new Podio token (first 10 chars):", cachedToken.slice(0, 10));
    return cachedToken;
}
