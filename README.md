# mcp-visomatickets

MCP-Server für die Visoma Tickets API. Exponiert alle API-Endpunkte als MCP-Tools für Claude.

## Setup

```bash
npm install
npm run build
```

## Konfiguration (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "visoma-tickets": {
      "command": "node",
      "args": ["/absoluter/pfad/zu/mcp-visomatickets/dist/index.js"],
      "env": {
        "VISOMA_BASE_URL": "https://firma.visoma-tickets.de",
        "VISOMA_TOKEN": "dein-token",
        "VISOMA_USERNAME": "optional-fuer-volltextsuche",
        "VISOMA_PASSWORD": "optional-fuer-volltextsuche"
      }
    }
  }
}
```

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| VISOMA_BASE_URL | Ja | Basis-URL der Visoma-Instanz |
| VISOMA_TOKEN | Ja | API-Token aus Admin-Einstellungen |
| VISOMA_USERNAME | Nein | Nur für fulltext_search |
| VISOMA_PASSWORD | Nein | Nur für fulltext_search |
