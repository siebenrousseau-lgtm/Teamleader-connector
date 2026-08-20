# Teamleader-connector voor Claude

Een kleine, private MCP-server die Claude toegang geeft tot Teamleader Focus:
deals/offertes, contacten, bedrijven en facturen opzoeken.

Deze README loopt de resterende stappen door — de app in Teamleader staat
al klaar (Client ID/Secret), dit deel gaat over **hosten** en **koppelen**.

## Wat zit erin

- `server.js` — de webserver: OAuth2-koppeling (`/auth`, `/oauth/callback`) + het MCP-endpoint (`/mcp`)
- `tokenStore.js` — bewaart en ververst de Teamleader-tokens (in `tokens.json`, nooit committen)
- `teamleaderClient.js` — de eigenlijke API-aanroepen naar Teamleader
- Tools die Claude straks kan gebruiken: `search_deals`, `get_deal`, `search_contacts`, `search_companies`, `search_invoices`, `get_invoice`

## Stap 1 — Lokaal testen (optioneel maar aangeraden)

```bash
npm install
cp .env.example .env
```

Vul in `.env` uw echte `TEAMLEADER_CLIENT_ID` en `TEAMLEADER_CLIENT_SECRET` in
(uit het Dev Portal, tabblad "Oauth2 Credentials"). Laat `TEAMLEADER_REDIRECT_URI`
op de lokale waarde staan.

```bash
npm start
```

Open `http://localhost:3000/auth` in de browser, log in bij Teamleader, en
keur de koppeling goed. U krijgt een "Gelukt ✅"-pagina te zien, en er
verschijnt een `tokens.json` in deze map — dat betekent dat de koppeling werkt.

**Let op:** de `Valid Redirect URIs` in het Teamleader Dev Portal moet exact
overeenkomen met `TEAMLEADER_REDIRECT_URI` in `.env`. Voor lokaal testen is
dat `http://localhost:3000/oauth/callback` — pas dat aan in het Dev Portal
als daar nog `https://localhost/callback` staat.

## Stap 2 — Hosten

Deze server moet 24/7 online staan zodat Claude er altijd bij kan. Twee
eenvoudige, goedkope/gratis opties:

### Optie A — Render.com (aangeraden, eenvoudigst)

1. Zet deze map in een (privé) GitHub-repository.
2. Ga naar [render.com](https://render.com) → **New** → **Web Service** → koppel de repository.
3. Instellingen: Build command `npm install`, Start command `npm start`.
4. Onder **Environment**, voeg toe: `TEAMLEADER_CLIENT_ID`, `TEAMLEADER_CLIENT_SECRET`, `TEAMLEADER_REDIRECT_URI` (zie stap 3 hieronder voor de juiste waarde).
5. Deploy. Render geeft u een URL zoals `https://teamleader-connector.onrender.com`.

### Optie B — Railway.app

Zelfde principe: repository koppelen, environment variables invullen bij
**Variables**, Railway detecteert `npm start` automatisch.

## Stap 3 — Redirect URI bijwerken

Zodra u de live URL heeft (bv. `https://teamleader-connector.onrender.com`):

1. In het Teamleader Dev Portal, onder **Oauth2 Credentials** → **Valid Redirect URIs**, zet:
   `https://teamleader-connector.onrender.com/oauth/callback`
2. In de hosting-omgevingsvariabelen (Render/Railway), zet `TEAMLEADER_REDIRECT_URI` op diezelfde waarde.
3. Herstart de service zodat de nieuwe omgevingsvariabele actief wordt.

## Stap 4 — Eenmalige koppeling (live)

Open `https://<uw-hosting-url>/auth` in de browser, log in bij Teamleader,
keur goed. Dit hoeft u maar één keer te doen — de server ververst de
toegang zelf automatisch daarna.

## Stap 5 — Toevoegen in Claude

In Claude: **Instellingen → Connectors → Aangepaste connector toevoegen**,
en geef als URL:

```
https://<uw-hosting-url>/mcp
```

Zodra dat is toegevoegd, kan u Claude vragen zoals *"zoek het project
Destelbergen op in Teamleader"* of *"wat staat er in de laatste factuur van
Stadsbader"* — de connector zoekt het rechtstreeks op.

## Veiligheid — kort samengevat

- `.env` en `tokens.json` bevatten geheimen. Beide staan in `.gitignore` en horen nooit gedeeld of gecommit te worden.
- De Client Secret die eerder zichtbaar was in een screenshot: overweeg die te regenereren in het Dev Portal voor de zekerheid, en werk dan ook `.env`/de hosting-variabelen bij met de nieuwe waarde.
- Deze connector is uitsluitend leesbaar opgezet (zoeken/ophalen) — er zit geen functionaliteit in om gegevens in Teamleader te wijzigen of te verwijderen.

## Uitbreiden

Nieuwe tools toevoegen is telkens hetzelfde patroon: een functie in
`teamleaderClient.js` die de juiste Teamleader-"action" aanroept (zie
[developer.teamleader.eu](https://developer.teamleader.eu) voor de volledige
lijst, bv. `projects.list`, `timeTracking.list`, ...), en een bijhorend
`server.registerTool(...)`-blok in `server.js`.
