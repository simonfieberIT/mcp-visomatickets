# Visoma Tickets MCP Server — Design

**Datum:** 2026-04-18  
**Status:** Genehmigt

---

## Überblick

Ein MCP-Server in TypeScript/Node.js, der die vollständige Visoma Tickets API (v02.2025) als MCP-Tools exponiert. Claude kann damit direkt auf die Visoma-Instanz des Nutzers zugreifen — Tickets erstellen, Zeiten erfassen, Kunden verwalten, Abrechnungen auswerten und mehr.

---

## Konfiguration

Der Server wird über Umgebungsvariablen konfiguriert:

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `VISOMA_BASE_URL` | Ja | Basis-URL der Instanz, z. B. `https://firma.visoma-tickets.de` |
| `VISOMA_TOKEN` | Ja | API-Token aus Admin → Einstellungen → Module → Grundeinstellungen |
| `VISOMA_USERNAME` | Nein | Nur für Elasticsearch-Volltextsuche benötigt |
| `VISOMA_PASSWORD` | Nein | Nur für Elasticsearch-Volltextsuche benötigt |

---

## Architektur

**Transport:** stdio (Standard für lokale MCP-Server in Claude Desktop)  
**Laufzeit:** Node.js mit TypeScript  
**SDK:** `@modelcontextprotocol/sdk`

### Projektstruktur

```
mcp-visomatickets/
├── src/
│   ├── index.ts              # MCP-Server-Einstiegspunkt, Tool-Registrierung
│   ├── client.ts             # HTTP-Client (fetch-Wrapper, Auth, Fehlerbehandlung)
│   └── tools/
│       ├── tickets.ts        # Tickets: search, create, update, lock/unlock, upload
│       ├── timers.ts         # Zeiten: search, create, update, start
│       ├── ghostwriter.ts    # Ghostwriter-Abrechnungsübersicht
│       ├── invoices.ts       # Leistungsnachweise
│       ├── customers.ts      # Kunden: search, create, update, get_by_email
│       ├── contacts.ts       # Kontakte: search, create, update
│       ├── addresses.ts      # Adressen: search, create, update
│       ├── users.ts          # Benutzer: search, create, update
│       ├── articles.ts       # Artikel: search, create, update
│       ├── assets.ts         # Geräte/Assets: search, create, update
│       ├── projects.ts       # Projekte: search, create, update
│       ├── categories.ts     # Kategorien: search, create, update
│       ├── status.ts         # Ticketstatus: search, create, update
│       ├── priorities.ts     # Prioritäten: search, create, update
│       ├── types.ts          # Tickettypen + Timertypen: search, create, update
│       ├── email.ts          # E-Mail: send, search, unread
│       ├── webhooks.ts       # Webhooks: search, create, update, get_attributes
│       ├── checklists.ts     # Checklisten-Vorlagen: search, create, update
│       ├── templates.ts      # Nachrichten- & Textbausteine: search
│       ├── conceptoffice.ts  # Concept-Office: search, mark_exported
│       ├── rmm.ts            # RMM Checks: search, create, update, clear
│       └── search.ts         # Elasticsearch-Volltextsuche
├── package.json
└── tsconfig.json
```

---

## HTTP-Client (`client.ts`)

Kapselt alle HTTP-Aufrufe mit:

- **Auth:** Token wird automatisch als `?token=...` Query-Parameter angehängt
- **Filterung:** Hilfsfunktion `buildFilterPath(filters)` wandelt `{ CustomerNumber: "A001", QueryLimit: 50 }` in `/params[CustomerNumber]/A001/params[QueryLimit]/50/` um
- **Fehlerbehandlung:** Prüft `{ Success: false, Message: "..." }` aus der API und wirft strukturierte Fehler; HTTP-Fehler (401, 404 etc.) werden ebenfalls abgefangen und lesbar zurückgegeben

```typescript
async function apiGet(path: string, params?: Record<string, string>): Promise<unknown>
async function apiPost(path: string, body: unknown): Promise<unknown>
async function apiPut(path: string, body: unknown): Promise<unknown>
```

---

## MCP-Tools (vollständige Liste)

### Tickets
| Tool | Beschreibung |
|------|--------------|
| `search_tickets` | Tickets suchen/listen mit beliebigen Filtern |
| `create_ticket` | Neues Ticket erstellen |
| `update_ticket` | Ticket aktualisieren (Lock/Unlock intern automatisch) |
| `lock_ticket` | Ticket manuell sperren |
| `unlock_ticket` | Ticket manuell entsperren |
| `upload_file_to_ticket` | Dokument an Ticket anhängen |

**Hinweis Lock-Workflow:** `update_ticket` führt Lock → PUT → Unlock automatisch durch. Claude muss sich nicht darum kümmern.

### Zeiten (Timer)
| Tool | Beschreibung |
|------|--------------|
| `search_timers` | Zeiten suchen/listen |
| `create_timer` | Zeit erfassen |
| `update_timer` | Zeit aktualisieren (kein Lock erforderlich) |
| `start_timer` | Laufenden Timer starten |

### Ghostwriter & Abrechnung
| Tool | Beschreibung |
|------|--------------|
| `search_ghostwriter` | Abrechnungsübersicht mit allen Filtern (billable, ininvoice, customerid, startdate, etc.) |
| `search_invoices` | Leistungsnachweise suchen |

### Kunden
| Tool | Beschreibung |
|------|--------------|
| `search_customers` | Kunden suchen/listen |
| `create_customer` | Kunden anlegen |
| `update_customer` | Kunden aktualisieren |
| `get_customer_by_email` | Kunden per E-Mail-Adresse suchen |

### Kontakte
| Tool | Beschreibung |
|------|--------------|
| `search_contacts` | Kontakte suchen |
| `create_contact` | Kontakt anlegen |
| `update_contact` | Kontakt aktualisieren |

### Adressen
| Tool | Beschreibung |
|------|--------------|
| `search_addresses` | Adressen suchen |
| `create_address` | Adresse anlegen |
| `update_address` | Adresse aktualisieren |

### Benutzer
| Tool | Beschreibung |
|------|--------------|
| `search_users` | Benutzer suchen |
| `create_user` | Benutzer anlegen |
| `update_user` | Benutzer aktualisieren |

### Artikel
| Tool | Beschreibung |
|------|--------------|
| `search_articles` | Artikel suchen |
| `create_article` | Artikel anlegen |
| `update_article` | Artikel aktualisieren |

### Geräte (Assets)
| Tool | Beschreibung |
|------|--------------|
| `search_assets` | Geräte suchen |
| `create_asset` | Gerät anlegen |
| `update_asset` | Gerät aktualisieren |

### Projekte
| Tool | Beschreibung |
|------|--------------|
| `search_projects` | Projekte suchen |
| `create_project` | Projekt anlegen |
| `update_project` | Projekt aktualisieren |

### Kategorien
| Tool | Beschreibung |
|------|--------------|
| `search_categories` | Kategorien suchen |
| `create_category` | Kategorie anlegen |
| `update_category` | Kategorie aktualisieren |

### Status
| Tool | Beschreibung |
|------|--------------|
| `search_ticket_status` | Ticketstatus suchen |
| `create_ticket_status` | Status anlegen |
| `update_ticket_status` | Status aktualisieren |

### Prioritäten
| Tool | Beschreibung |
|------|--------------|
| `search_priorities` | Prioritäten suchen |
| `create_priority` | Priorität anlegen |
| `update_priority` | Priorität aktualisieren |

### Tickettypen & Timertypen
| Tool | Beschreibung |
|------|--------------|
| `search_ticket_types` | Tickettypen suchen |
| `create_ticket_type` | Tickettyp anlegen |
| `update_ticket_type` | Tickettyp aktualisieren |
| `search_timer_types` | Timertypen auflisten |

### E-Mail
| Tool | Beschreibung |
|------|--------------|
| `send_email` | E-Mail versenden |
| `search_messages` | E-Mails zu einem Ticket suchen |
| `get_unread_messages` | Ungelesene E-Mails abrufen |

### Webhooks
| Tool | Beschreibung |
|------|--------------|
| `search_webhooks` | Webhooks auflisten |
| `create_webhook` | Webhook anlegen |
| `update_webhook` | Webhook aktualisieren |
| `get_webhook_attributes` | Verfügbare Webhook-Attribute abrufen |

### Vorlagen & Bausteine
| Tool | Beschreibung |
|------|--------------|
| `search_message_templates` | Nachrichtenvorlagen auflisten |
| `search_text_templates` | Textbausteine auflisten |
| `search_checklist_templates` | Checklisten-Vorlagen suchen |
| `create_checklist_template` | Checklisten-Vorlage anlegen |
| `update_checklist_template` | Checklisten-Vorlage aktualisieren |

### Concept-Office
| Tool | Beschreibung |
|------|--------------|
| `search_conceptoffice_times` | Zeiten für Concept-Office-Export abrufen |
| `mark_times_as_exported` | Zeiten als exportiert markieren |

### RMM Checks
| Tool | Beschreibung |
|------|--------------|
| `search_rmm_checks` | RMM-Checks suchen |
| `create_rmm_check` | Fehlgeschlagenen Check melden |
| `update_rmm_check` | Check aktualisieren |
| `clear_rmm_check` | Check zurücksetzen |

### Volltextsuche
| Tool | Beschreibung |
|------|--------------|
| `fulltext_search` | Elasticsearch-Volltextsuche über Tickets, Kunden, Projekte, Dokumente (erfordert `VISOMA_USERNAME` + `VISOMA_PASSWORD`) |

---

## Deployment (Claude Desktop)

Eintrag in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "visoma-tickets": {
      "command": "node",
      "args": ["/pfad/zu/mcp-visomatickets/dist/index.js"],
      "env": {
        "VISOMA_BASE_URL": "https://firma.visoma-tickets.de",
        "VISOMA_TOKEN": "dein-token-hier",
        "VISOMA_USERNAME": "optional",
        "VISOMA_PASSWORD": "optional"
      }
    }
  }
}
```

## Testing

Kein automatisiertes Test-Setup im initialen Scope. Manuelle Tests über MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Offene Punkte / Nicht im Scope

- Automatisierte Tests (Unit/Integration)
- CTI-Endpunkte (Browser-Opener, nicht sinnvoll als MCP-Tool)
- Benutzergruppen-Management (`/api2/usergroups/`) — kann nachgezogen werden
