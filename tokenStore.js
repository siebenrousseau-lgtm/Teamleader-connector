// tokenStore.js
//
// Bewaart en ververst de OAuth2-tokens voor Teamleader.
//
// Belangrijk: Teamleader's refresh tokens zijn "single use" — telkens je
// een nieuwe access token opvraagt met de refresh token, krijg je ook een
// gloednieuwe refresh token terug die de oude vervangt. Daarom
// slaan we de tokens op in een lokaal bestand (tokens.json) in plaats van
// enkel in het geheugen: zo overleeft de login een herstart van de server.
//
// tokens.json wordt NOOIT mee gecommit (zie .gitignore) — behandel het
// bestand als een wachtwoord.

const fs = require("fs");
const path = require("path");
const axios = require("axios");

const TOKENS_PATH = path.join(__dirname, "tokens.json");
const TOKEN_URL = "https://focus.teamleader.eu/oauth2/access_token";

function readTokens() {
  if (!fs.existsSync(TOKENS_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
  } catch (e) {
    return null;
  }
}

function writeTokens(tokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2), "utf8");
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
  writeTokens(tokens);
  return tokens;
}

async function refreshTokens() {
  const current = readTokens();
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
  writeTokens(tokens);
  return tokens;
}

async function getValidAccessToken() {
  let tokens = readTokens();
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
