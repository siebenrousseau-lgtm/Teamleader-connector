// tokenStore.js
//
// Bewaart en ververst de OAuth2-tokens voor Teamleader.
//
// Belangrijk: Teamleader's refresh tokens zijn "single use" — telkens je
// een nieuwe access token opvraagt met de refresh token, krijg je ook een
// gloednieuwe refresh token terug die de oude vervangt.
//
// We slaan de tokens op in Upstash Redis (gratis, geen kaart nodig) in
// plaats van een lokaal bestand. Dat is nodig omdat hostingdiensten zoals
// Vercel de code "serverless" draaien: elke aanvraag kan op een ander,
// tijdelijk exemplaar van de server terechtkomen, waardoor een lokaal
// bestand niet betrouwbaar bewaard blijft tussen aanvragen door.

const { Redis } = require("@upstash/redis");
const axios = require("axios");

const redis = Redis.fromEnv(); // leest UPSTASH_REDIS_REST_URL / _TOKEN uit .env
const REDIS_KEY = "teamleader_tokens";
const TOKEN_URL = "https://focus.teamleader.eu/oauth2/access_token";

async function readTokens() {
  return await redis.get(REDIS_KEY); // geeft null terug als er nog niets is opgeslagen
}

async function writeTokens(tokens) {
  await redis.set(REDIS_KEY, tokens);
}

async function exchangeCodeForTokens(code) {
  const res = await axios.post(TOKEN_URL, {
    client_id: process.env.TEAMLEADER_CLIENT_ID,
    client_secret: process.env.TEAMLEADER_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.TEAMLEADER_REDIRECT_URI,
  });
  const tokens = {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at: Date.now() + res.data.expires_in * 1000 - 30_000, // 30s speling
  };
  await writeTokens(tokens);
  return tokens;
}

async function refreshTokens() {
  const current = await readTokens();
  if (!current || !current.refresh_token) {
    throw new Error(
      "Geen refresh token gevonden. Doorloop eerst de eenmalige koppeling via /auth."
    );
  }
  const res = await axios.post(TOKEN_URL, {
    client_id: process.env.TEAMLEADER_CLIENT_ID,
    client_secret: process.env.TEAMLEADER_CLIENT_SECRET,
    refresh_token: current.refresh_token,
    grant_type: "refresh_token",
  });
  const tokens = {
    access_token: res.data.access_token,
    // Teamleader stuurt bij een refresh soms geen nieuwe refresh_token mee —
    // val in dat geval terug op de vorige.
    refresh_token: res.data.refresh_token || current.refresh_token,
    expires_at: Date.now() + res.data.expires_in * 1000 - 30_000,
  };
  await writeTokens(tokens);
  return tokens;
}

async function getValidAccessToken() {
  let tokens = await readTokens();
  if (!tokens) {
    throw new Error(
      "Nog niet gekoppeld met Teamleader. Open /auth in de browser en rond de koppeling af."
    );
  }
  if (Date.now() >= tokens.expires_at) {
    tokens = await refreshTokens();
  }
  return tokens.access_token;
}

module.exports = { exchangeCodeForTokens, refreshTokens, getValidAccessToken, readTokens };
