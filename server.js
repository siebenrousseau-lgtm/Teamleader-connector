// server.js
//
// Eén Express-app met twee onderdelen:
//
//   1. De OAuth2-koppeling met Teamleader ( /auth en /oauth/callback ).
//      Dit doorloop je EENMALIG, met de hand, in je browser.
//
//   2. De MCP-server zelf ( /mcp ), die Claude aanspreekt zodra de
//      connector is toegevoegd in de Claude-instellingen.
//
// Zie README.md voor de volledige uitleg en de deploy-stappen.

require("dotenv").config();
const express = require("express");
const { z } = require("zod");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");

const { exchangeCodeForTokens, readTokens } = require("./tokenStore");
const teamleader = require("./teamleaderClient");

const REQUIRED_ENV = [
  "TEAMLEADER_CLIENT_ID",
  "TEAMLEADER_CLIENT_SECRET",
  "TEAMLEADER_REDIRECT_URI",
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Ontbrekende omgevingsvariabele: ${key} (zie .env.example)`);
    process.exit(1);
  }
}

const app = express();
app.use(express.json());

// ---------------------------------------------------------------------
// 1. OAuth2-koppeling
// ---------------------------------------------------------------------

app.get("/", async (req, res) => {
  const tokens = await readTokens();
  res.send(`
    <h1>Teamleader connector</h1>
    <p>Status: ${tokens ? "✅ gekoppeld met Teamleader" : "❌ nog niet gekoppeld"}</p>
    ${!tokens ? '<p><a href="/auth">Klik hier om te koppelen met Teamleader</a></p>' : ""}
    <p>MCP-endpoint: <code>${req.protocol}://${req.get("host")}/mcp</code></p>
  `);
});

app.get("/auth", (req, res) => {
  const authorizeUrl = new URL("https://focus.teamleader.eu/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.TEAMLEADER_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", process.env.TEAMLEADER_REDIRECT_URI);
  res.redirect(authorizeUrl.toString());
});

app.get("/oauth/callback", async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`Teamleader gaf een fout terug: ${error}`);
  }
  if (!code) {
    return res.status(400).send("Geen 'code' parameter ontvangen van Teamleader.");
  }
  try {
    await exchangeCodeForTokens(code);
    res.send(
      "<h1>Gelukt ✅</h1><p>De connector is gekoppeld met Teamleader. Je mag dit tabblad sluiten.</p>"
    );
  } catch (e) {
    console.error(e.response?.data || e.message);
    res
      .status(500)
      .send(`<h1>Mislukt</h1><pre>${JSON.stringify(e.response?.data || e.message, null, 2)}</pre>`);
  }
});

// ---------------------------------------------------------------------
// 2. MCP-server
// ---------------------------------------------------------------------

function buildMcpServer() {
  const server = new McpServer({ name: "teamleader-connector", version: "1.0.0" });

  server.registerTool(
    "search_deals",
    {
      title: "Zoek deals/offertes in Teamleader",
      description:
        "Zoekt deals (offertes/projecten) in Teamleader op basis van een zoekterm, bv. een klantnaam of projectnaam.",
      inputSchema: { query: z.string().describe("Zoekterm, bv. 'Destelbergen' of 'Stadsbader'") },
    },
    async ({ query }) => {
      const data = await teamleader.searchDeals(query);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "get_deal",
    {
      title: "Haal details van één deal op",
      description: "Haalt de volledige details van één deal op via het Teamleader-ID.",
      inputSchema: { id: z.string().describe("Het Teamleader deal-ID") },
    },
    async ({ id }) => {
      const data = await teamleader.getDeal(id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "search_contacts",
    {
      title: "Zoek contactpersonen",
      description: "Zoekt contactpersonen in Teamleader op naam, e-mail of bedrijf.",
      inputSchema: { query: z.string().describe("Zoekterm, bv. 'Ruth Pauwels'") },
    },
    async ({ query }) => {
      const data = await teamleader.searchContacts(query);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "search_companies",
    {
      title: "Zoek bedrijven",
      description: "Zoekt bedrijven/klanten in Teamleader op naam.",
      inputSchema: { query: z.string().describe("Zoekterm, bv. 'Stadsbader'") },
    },
    async ({ query }) => {
      const data = await teamleader.searchCompanies(query);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "search_invoices",
    {
      title: "Zoek facturen",
      description:
        "Zoekt facturen in Teamleader. Alle velden zijn optioneel en mogen gecombineerd worden: " +
        "zoekterm (klant/referentie), periode op factuurdatum, en/of betaalstatus.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe("Zoekterm, bv. klantnaam of factuurreferentie (optioneel)"),
        date_from: z
          .string()
          .optional()
          .describe("Alleen facturen met factuurdatum vanaf deze datum, formaat YYYY-MM-DD (optioneel)"),
        date_to: z
          .string()
          .optional()
          .describe("Alleen facturen met factuurdatum tot deze datum, formaat YYYY-MM-DD (optioneel)"),
        status: z
          .enum(["draft", "outstanding", "matched"])
          .optional()
          .describe(
            "Filter op status: 'outstanding' = nog niet (volledig) betaald, 'matched' = betaald/vereffend, 'draft' = concept (optioneel)"
          ),
      },
    },
    async ({ query, date_from, date_to, status }) => {
      const data = await teamleader.searchInvoices({
        query,
        dateFrom: date_from,
        dateTo: date_to,
        status,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    "get_invoice",
    {
      title: "Haal details van één factuur op",
      description: "Haalt de volledige details van één factuur op via het Teamleader-ID.",
      inputSchema: { id: z.string().describe("Het Teamleader factuur-ID") },
    },
    async ({ id }) => {
      const data = await teamleader.getInvoice(id);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}

// Eén server-instantie + transport per request, zoals de MCP SDK aanraadt
// voor "stateless" Streamable HTTP servers.
app.post("/mcp", async (req, res) => {
  try {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("MCP-fout:", e);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Interne serverfout" },
        id: null,
      });
    }
  }
});

// Lokaal (met "npm start") draait dit als een gewone, altijd-luisterende
// server. Op Vercel wordt de app zelf geëxporteerd en als serverless
// functie aangeroepen — vandaar de "require.main === module"-check.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Teamleader-connector draait op poort ${PORT}`);
    console.log(`Open http://localhost:${PORT} om de koppelstatus te zien.`);
  });
}

module.exports = app;
