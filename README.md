# mcp-visomatickets

MCP-Server für die [Visoma Tickets](https://www.visoma.de) API. Exponiert alle API-Endpunkte als MCP-Tools, sodass KI-Assistenten wie Claude direkt mit Visoma interagieren können.

## Kompatibilität

Getestet mit **Visoma API v1.7.0** (Visoma-Release 02.2025). Zukünftige Weiterentwicklungen sollen abwärtskompatibel gestaltet werden, sodass ältere Versionen weiterhin unterstützt bleiben.

## Voraussetzungen

- Node.js 18+
- Eine laufende Visoma-Instanz mit aktiviertem API-Zugriff
- API-Token aus den Visoma Admin-Einstellungen

## Installation

```bash
git clone https://github.com/simonfieber/mcp-visomatickets.git
cd mcp-visomatickets
npm install
npm run build
```

## Konfiguration

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "visoma-tickets": {
      "command": "node",
      "args": ["/absoluter/pfad/zu/mcp-visomatickets/dist/index.js"],
      "env": {
        "VISOMA_BASE_URL": "https://firma.visoma-tickets.de",
        "VISOMA_TOKEN": "dein-api-token",
        "VISOMA_USERNAME": "optionaler-benutzername",
        "VISOMA_PASSWORD": "optionales-passwort"
      }
    }
  }
}
```

### Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|:-------:|--------------|
| `VISOMA_BASE_URL` | ✅ | Basis-URL der Visoma-Instanz |
| `VISOMA_TOKEN` | ✅ | API-Token aus den Admin-Einstellungen |
| `VISOMA_USERNAME` | — | Nur für `fulltext_search` erforderlich |
| `VISOMA_PASSWORD` | — | Nur für `fulltext_search` erforderlich |

## Verfügbare Tools

### Tickets
`search_tickets` · `create_ticket` · `update_ticket` · `lock_ticket` · `unlock_ticket` · `check_ticket_lock` · `upload_file_to_ticket`

### Artikel & Kommentare
`search_articles` · `create_article` · `update_article`

### Kunden & Kontakte
`search_customers` · `create_customer` · `update_customer` · `get_customer_by_email` · `search_contacts` · `create_contact` · `update_contact`

### Adressen
`search_addresses` · `create_address` · `update_address`

### Benutzer & Gruppen
`search_users` · `create_user` · `update_user` · `search_usergroups` · `create_usergroup` · `update_usergroup`

### Assets
`search_assets` · `create_asset` · `update_asset`

### Projekte
`search_projects` · `create_project` · `update_project`

### Zeiterfassung
`search_timers` · `create_timer` · `update_timer` · `start_timer` · `search_timer_types` · `search_conceptoffice_times` · `mark_times_as_exported`

### Stammdaten
`search_categories` · `create_category` · `update_category` · `search_priorities` · `create_priority` · `update_priority` · `search_ticket_status` · `create_ticket_status` · `update_ticket_status` · `search_ticket_types` · `create_ticket_type` · `update_ticket_type`

### Kommunikation & Benachrichtigungen
`send_email` · `get_unread_messages` · `search_messages` · `search_message_templates` · `create_webhook` · `update_webhook` · `search_webhooks` · `get_webhook_attributes`

### Vorlagen & Checklisten
`search_text_templates` · `search_checklist_templates` · `create_checklist_template` · `update_checklist_template`

### Sonstiges
`fulltext_search` · `search_ghostwriter` · `search_invoices` · `search_rmm_checks` · `create_rmm_check` · `update_rmm_check` · `clear_rmm_check`

## Entwicklung

```bash
npm run dev    # Direkt mit tsx ausführen (kein Build nötig)
npm run build  # Produktions-Build nach dist/
```

## Lizenz

MIT + Commons Clause — Nutzung und Weiterentwicklung erlaubt, Weiterverkauf nicht. Siehe [LICENSE](LICENSE).
