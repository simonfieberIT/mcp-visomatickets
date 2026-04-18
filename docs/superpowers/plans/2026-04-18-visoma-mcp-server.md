# Visoma Tickets MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen MCP-Server in TypeScript/Node.js bauen, der die vollständige Visoma Tickets API als ~50 MCP-Tools exponiert.

**Architecture:** Jede API-Ressource hat eine eigene Tool-Datei unter `src/tools/`. Ein zentraler HTTP-Client in `src/client.ts` übernimmt Auth (Token als Query-Parameter), Filterung (`buildFilterPath`) und Fehlerbehandlung. `src/index.ts` registriert alle Tools und startet den MCP-Server via stdio.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk`, `zod` (Schema-Validierung), `tsx` (Dev-Run), `tsup` (Build)

---

## File Map

| Datei | Verantwortlichkeit |
|-------|--------------------|
| `src/index.ts` | Server-Einstiegspunkt, Tool-Registrierung, Env-Validierung |
| `src/client.ts` | HTTP-Client: apiGet, apiPost, apiPut, buildFilterPath, Fehlerbehandlung |
| `src/tools/tickets.ts` | search_tickets, create_ticket, update_ticket, lock_ticket, unlock_ticket, upload_file_to_ticket |
| `src/tools/timers.ts` | search_timers, create_timer, update_timer, start_timer |
| `src/tools/ghostwriter.ts` | search_ghostwriter |
| `src/tools/invoices.ts` | search_invoices |
| `src/tools/customers.ts` | search_customers, create_customer, update_customer, get_customer_by_email |
| `src/tools/contacts.ts` | search_contacts, create_contact, update_contact |
| `src/tools/addresses.ts` | search_addresses, create_address, update_address |
| `src/tools/users.ts` | search_users, create_user, update_user |
| `src/tools/articles.ts` | search_articles, create_article, update_article |
| `src/tools/assets.ts` | search_assets, create_asset, update_asset |
| `src/tools/projects.ts` | search_projects, create_project, update_project |
| `src/tools/categories.ts` | search_categories, create_category, update_category |
| `src/tools/status.ts` | search_ticket_status, create_ticket_status, update_ticket_status |
| `src/tools/priorities.ts` | search_priorities, create_priority, update_priority |
| `src/tools/types.ts` | search_ticket_types, create_ticket_type, update_ticket_type, search_timer_types |
| `src/tools/email.ts` | send_email, search_messages, get_unread_messages |
| `src/tools/webhooks.ts` | search_webhooks, create_webhook, update_webhook, get_webhook_attributes |
| `src/tools/checklists.ts` | search_checklist_templates, create_checklist_template, update_checklist_template |
| `src/tools/templates.ts` | search_message_templates, search_text_templates |
| `src/tools/conceptoffice.ts` | search_conceptoffice_times, mark_times_as_exported |
| `src/tools/rmm.ts` | search_rmm_checks, create_rmm_check, update_rmm_check, clear_rmm_check |
| `src/tools/search.ts` | fulltext_search (Elasticsearch) |

---

### Task 1: Projekt-Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Schritt 1: package.json anlegen**

```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript tsx tsup @types/node
```

Dann `package.json` anpassen:

```json
{
  "name": "mcp-visomatickets",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "files": ["dist"]
}
```

- [ ] **Schritt 2: tsconfig.json anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Schritt 3: .gitignore anlegen**

```
node_modules/
dist/
.env
```

- [ ] **Schritt 4: .env.example anlegen**

```
VISOMA_BASE_URL=https://firma.visoma-tickets.de
VISOMA_TOKEN=dein-token-hier
VISOMA_USERNAME=optional-fuer-volltextsuche
VISOMA_PASSWORD=optional-fuer-volltextsuche
```

- [ ] **Schritt 5: Committen**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example
git commit -m "chore: project setup with TypeScript and MCP SDK"
```

---

### Task 2: HTTP-Client (`src/client.ts`)

**Files:**
- Create: `src/client.ts`

- [ ] **Schritt 1: client.ts anlegen**

```typescript
const BASE_URL = process.env.VISOMA_BASE_URL?.replace(/\/$/, "");
const TOKEN = process.env.VISOMA_TOKEN;

if (!BASE_URL || !TOKEN) {
  throw new Error("VISOMA_BASE_URL and VISOMA_TOKEN environment variables are required");
}

export function buildFilterPath(filters: Record<string, string | number>): string {
  return Object.entries(filters)
    .map(([key, value]) => `params[${key}]/${value}`)
    .join("/") + "/";
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("token", TOKEN!);

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText} for ${method} ${path}`);
  }

  const data = await res.json() as { Success?: boolean; Message?: string };

  if (data.Success === false) {
    throw new Error(`Visoma API error: ${data.Message ?? "Unknown error"}`);
  }

  return data;
}

export async function apiGet(path: string): Promise<unknown> {
  return request("GET", path);
}

export async function apiPost(path: string, body: unknown): Promise<unknown> {
  return request("POST", path, body);
}

export async function apiPut(path: string, body: unknown): Promise<unknown> {
  return request("PUT", path, body);
}

export function getBasicAuthHeaders(): Record<string, string> {
  const username = process.env.VISOMA_USERNAME;
  const password = process.env.VISOMA_PASSWORD;
  if (!username || !password) {
    throw new Error("VISOMA_USERNAME and VISOMA_PASSWORD are required for fulltext search");
  }
  return {
    "X_VSM_USERNAME": username,
    "X_VSM_PASSWORD": password,
  };
}
```

- [ ] **Schritt 2: Kompilierung prüfen**

```bash
npx tsc --noEmit
```

Erwartung: keine Fehler.

- [ ] **Schritt 3: Committen**

```bash
git add src/client.ts
git commit -m "feat: add HTTP client with auth and filter path builder"
```

---

### Task 3: MCP-Server-Einstiegspunkt (`src/index.ts`)

**Files:**
- Create: `src/index.ts`

- [ ] **Schritt 1: index.ts anlegen (zunächst ohne Tools)**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "visoma-tickets",
  version: "0.1.0",
});

// Tools werden in späteren Tasks hier registriert

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Schritt 2: Dev-Start prüfen**

```bash
npm run dev
```

Erwartung: Server startet ohne Fehler, wartet auf stdio-Input.  
Mit Ctrl+C beenden.

- [ ] **Schritt 3: Committen**

```bash
git add src/index.ts
git commit -m "feat: add MCP server entrypoint"
```

---

### Task 4: Ticket-Tools (`src/tools/tickets.ts`)

**Files:**
- Create: `src/tools/tickets.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: tickets.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerTicketTools(server: McpServer) {
  server.tool(
    "search_tickets",
    "Tickets in Visoma suchen und auflisten. Unterstützt Filter wie CustomerId, StatusId, ResponsibleId, QueryLimit.",
    {
      filters: z.record(z.union([z.string(), z.number()])).optional().describe(
        'Filter als Objekt, z. B. { "Customer.Number": "A001", "QueryLimit": 50 }'
      ),
    },
    async ({ filters }) => {
      const path = `/api2/tickets/search/${filters ? buildFilterPath(filters) : ""}`;
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_ticket",
    "Neues Ticket in Visoma erstellen.",
    {
      CustomerId: z.number().describe("Kunden-ID (Pflicht)"),
      AddressId: z.number().describe("Adress-ID (Pflicht)"),
      Title: z.string().describe("Titel des Tickets (Pflicht)"),
      Description: z.string().describe("Beschreibung (Pflicht)"),
      ResponsibleId: z.number().optional().describe("Verantwortlicher Benutzer"),
      PriorityId: z.number().optional().describe("Priorität"),
      StatusId: z.number().optional().describe("Status"),
      TypeId: z.number().optional().describe("Tickettyp"),
      DueOn: z.string().optional().describe("Fälligkeit: DD.MM.YYYY HH:mm:ss"),
      ContactId: z.number().optional().describe("Ansprechpartner-ID"),
      ArrangerIds: z.string().optional().describe("Kommagetrennte Bearbeiter-IDs"),
      ProjectIds: z.string().optional().describe("Kommagetrennte Projekt-IDs"),
      NotifyCustomer: z.number().optional().describe("Kunden benachrichtigen: 0 oder 1"),
    },
    async (body) => {
      const data = await apiPost("/api2/Ticket/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_ticket",
    "Ticket aktualisieren. Lock/Unlock wird automatisch durchgeführt.",
    {
      id: z.number().describe("Ticket-ID"),
      userId: z.number().describe("Benutzer-ID für den Lock"),
      fields: z.record(z.unknown()).describe("Zu ändernde Felder als Objekt"),
    },
    async ({ id, userId, fields }) => {
      await apiPost("/api2/do/function/Lock", { Model: "ticket", Id: id, Lock: userId });
      try {
        const data = await apiPut(`/api2/Ticket/${id}`, fields);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } finally {
        await apiPost("/api2/do/function/UnLock", { Model: "ticket", Id: id, Lock: userId });
      }
    }
  );

  server.tool(
    "lock_ticket",
    "Ticket manuell sperren.",
    {
      id: z.number().describe("Ticket-ID"),
      userId: z.number().describe("Benutzer-ID"),
    },
    async ({ id, userId }) => {
      const data = await apiPost("/api2/do/function/Lock", { Model: "ticket", Id: id, Lock: userId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "unlock_ticket",
    "Ticket manuell entsperren.",
    {
      id: z.number().describe("Ticket-ID"),
      userId: z.number().describe("Benutzer-ID"),
    },
    async ({ id, userId }) => {
      const data = await apiPost("/api2/do/function/UnLock", { Model: "ticket", Id: id, Lock: userId });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "upload_file_to_ticket",
    "Dokument an Ticket anhängen.",
    {
      ticketId: z.number().describe("Ticket-ID"),
      filename: z.string().describe("Dateiname"),
      content: z.string().describe("Dateiinhalt als Base64-String"),
    },
    async ({ ticketId, filename, content }) => {
      const data = await apiPost("/api2/do/function/UploadFile", { ticketId, filename, content });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: In index.ts registrieren**

```typescript
// Füge oben hinzu:
import { registerTicketTools } from "./tools/tickets.js";

// Vor server.connect():
registerTicketTools(server);
```

- [ ] **Schritt 3: Kompilierung prüfen**

```bash
npx tsc --noEmit
```

Erwartung: keine Fehler.

- [ ] **Schritt 4: Committen**

```bash
git add src/tools/tickets.ts src/index.ts
git commit -m "feat: add ticket tools (search, create, update, lock, unlock, upload)"
```

---

### Task 5: Timer-Tools (`src/tools/timers.ts`)

**Files:**
- Create: `src/tools/timers.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: timers.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerTimerTools(server: McpServer) {
  server.tool(
    "search_timers",
    "Zeiteinträge (Timer) suchen. Filter z. B. nach TicketId, UserId, Billable.",
    {
      filters: z.record(z.union([z.string(), z.number()])).optional().describe(
        'Filter als Objekt, z. B. { "TicketId": 1234, "UserId": 7 }'
      ),
    },
    async ({ filters }) => {
      const path = `/api2/Timer/search/${filters ? buildFilterPath(filters) : ""}`;
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_timer",
    "Neuen Zeiteintrag erfassen.",
    {
      UserId: z.number().describe("Benutzer-ID (Pflicht)"),
      Start: z.string().describe("Startzeit: DD.MM.YYYY HH:mm:ss (Pflicht)"),
      Stop: z.string().describe("Endzeit: DD.MM.YYYY HH:mm:ss (Pflicht)"),
      Description: z.string().describe("Tätigkeitsbeschreibung (Pflicht)"),
      TicketId: z.number().optional().describe("Ticket-ID"),
      ArticleId: z.number().optional().describe("Artikel-ID"),
      TypeId: z.number().optional().describe("Timertyp-ID"),
      Billable: z.number().optional().describe("Abrechenbar: 0 oder 1"),
      Closed: z.number().optional().describe("Abgeschlossen: 0 oder 1"),
      Approach: z.number().optional().describe("Anfahrt: 0 oder 1"),
      InternalNotice: z.string().optional().describe("Interne Notiz"),
    },
    async (body) => {
      const data = await apiPost("/api2/Timer/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_timer",
    "Zeiteintrag aktualisieren. Kein Lock erforderlich.",
    {
      id: z.number().describe("Timer-ID"),
      fields: z.record(z.unknown()).describe("Zu ändernde Felder, z. B. { Billable: 1, Closed: 1 }"),
    },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/Timer/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "start_timer",
    "Laufenden Timer starten.",
    {
      TicketId: z.number().describe("Ticket-ID"),
      UserId: z.number().describe("Benutzer-ID"),
    },
    async (body) => {
      const data = await apiPost("/api2/Timer/start/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: In index.ts registrieren**

```typescript
import { registerTimerTools } from "./tools/timers.js";
// ...
registerTimerTools(server);
```

- [ ] **Schritt 3: Kompilierung prüfen**

```bash
npx tsc --noEmit
```

- [ ] **Schritt 4: Committen**

```bash
git add src/tools/timers.ts src/index.ts
git commit -m "feat: add timer tools (search, create, update, start)"
```

---

### Task 6: Ghostwriter & Rechnungen (`src/tools/ghostwriter.ts`, `src/tools/invoices.ts`)

**Files:**
- Create: `src/tools/ghostwriter.ts`
- Create: `src/tools/invoices.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: ghostwriter.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, buildFilterPath } from "../client.js";

export function registerGhostwriterTools(server: McpServer) {
  server.tool(
    "search_ghostwriter",
    "Abrechnungsübersicht abrufen. Enthält Zeiteinträge mit Ticket-, Kunden-, Vertrags- und Abrechnungsinformationen. Filter z. B. billable, ininvoice, customerid, userid, startdate, contractid.",
    {
      filters: z.record(z.union([z.string(), z.number()])).optional().describe(
        'Filter als Objekt, z. B. { "billable": 1, "ininvoice": 0, "customerid": 42, "QueryLimit": 100 }'
      ),
    },
    async ({ filters }) => {
      const path = `/api2/ghostwriter/search${filters ? "/" + buildFilterPath(filters) : "/"}`;
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: invoices.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, buildFilterPath } from "../client.js";

export function registerInvoiceTools(server: McpServer) {
  server.tool(
    "search_invoices",
    "Leistungsnachweise (fertige Rechnungsdokumente) suchen.",
    {
      filters: z.record(z.union([z.string(), z.number()])).optional().describe(
        'Filter als Objekt, z. B. { "customerid": 42 }'
      ),
    },
    async ({ filters }) => {
      const path = `/api2/invoice/search/${filters ? buildFilterPath(filters) : ""}`;
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 3: In index.ts registrieren**

```typescript
import { registerGhostwriterTools } from "./tools/ghostwriter.js";
import { registerInvoiceTools } from "./tools/invoices.js";
// ...
registerGhostwriterTools(server);
registerInvoiceTools(server);
```

- [ ] **Schritt 4: Kompilierung prüfen**

```bash
npx tsc --noEmit
```

- [ ] **Schritt 5: Committen**

```bash
git add src/tools/ghostwriter.ts src/tools/invoices.ts src/index.ts
git commit -m "feat: add ghostwriter and invoice tools"
```

---

### Task 7: Kunden-Tools (`src/tools/customers.ts`)

**Files:**
- Create: `src/tools/customers.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: customers.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerCustomerTools(server: McpServer) {
  server.tool(
    "search_customers",
    "Kunden suchen und auflisten.",
    {
      filters: z.record(z.union([z.string(), z.number()])).optional().describe(
        'Filter als Objekt, z. B. { "Name": "Mustermann", "QueryLimit": 50 }'
      ),
    },
    async ({ filters }) => {
      const path = `/api2/Customer/search/${filters ? buildFilterPath(filters) : ""}`;
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_customer",
    "Neuen Kunden anlegen.",
    {
      Number: z.string().describe("Kundennummer, z. B. A001 (Pflicht)"),
      Name: z.string().describe("Firmenname (Pflicht)"),
      EMail: z.string().optional(),
      Fon: z.string().optional(),
      Fax: z.string().optional(),
      TicketInfo: z.string().optional(),
      Technician1Id: z.number().optional(),
      Technician2Id: z.number().optional(),
    },
    async (body) => {
      const data = await apiPost("/api2/Customer/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_customer",
    "Kunden aktualisieren.",
    {
      id: z.number().describe("Kunden-ID"),
      fields: z.record(z.unknown()).describe("Zu ändernde Felder"),
    },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/Customer/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_customer_by_email",
    "Kunden anhand einer E-Mail-Adresse suchen.",
    {
      mail: z.string().describe("E-Mail-Adresse"),
    },
    async ({ mail }) => {
      const data = await apiPost("/api2/do/function/GetCustomerByMail", { mail });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: In index.ts registrieren**

```typescript
import { registerCustomerTools } from "./tools/customers.js";
// ...
registerCustomerTools(server);
```

- [ ] **Schritt 3: Kompilierung prüfen**

```bash
npx tsc --noEmit
```

- [ ] **Schritt 4: Committen**

```bash
git add src/tools/customers.ts src/index.ts
git commit -m "feat: add customer tools (search, create, update, get_by_email)"
```

---

### Task 8: Kontakte, Adressen, Benutzer (`src/tools/contacts.ts`, `addresses.ts`, `users.ts`)

**Files:**
- Create: `src/tools/contacts.ts`
- Create: `src/tools/addresses.ts`
- Create: `src/tools/users.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: contacts.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerContactTools(server: McpServer) {
  server.tool(
    "search_contacts",
    "Kontakte suchen.",
    {
      filters: z.record(z.union([z.string(), z.number()])).optional(),
    },
    async ({ filters }) => {
      const data = await apiGet(`/api2/contact/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_contact",
    "Neuen Kontakt anlegen.",
    { fields: z.record(z.unknown()).describe("Kontaktfelder als Objekt") },
    async ({ fields }) => {
      const data = await apiPost("/api2/contact/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_contact",
    "Kontakt aktualisieren.",
    {
      id: z.number().describe("Kontakt-ID"),
      fields: z.record(z.unknown()),
    },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/contact/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: addresses.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerAddressTools(server: McpServer) {
  server.tool(
    "search_addresses",
    "Adressen suchen.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/address/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_address",
    "Neue Adresse anlegen.",
    { fields: z.record(z.unknown()).describe("Adressfelder als Objekt") },
    async ({ fields }) => {
      const data = await apiPost("/api2/address/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_address",
    "Adresse aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/address/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 3: users.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerUserTools(server: McpServer) {
  server.tool(
    "search_users",
    "Benutzer suchen.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/user/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "create_user",
    "Neuen Benutzer anlegen.",
    { fields: z.record(z.unknown()).describe("Benutzerfelder als Objekt") },
    async ({ fields }) => {
      const data = await apiPost("/api2/user/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_user",
    "Benutzer aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/user/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 4: In index.ts registrieren**

```typescript
import { registerContactTools } from "./tools/contacts.js";
import { registerAddressTools } from "./tools/addresses.js";
import { registerUserTools } from "./tools/users.js";
// ...
registerContactTools(server);
registerAddressTools(server);
registerUserTools(server);
```

- [ ] **Schritt 5: Kompilierung prüfen**

```bash
npx tsc --noEmit
```

- [ ] **Schritt 6: Committen**

```bash
git add src/tools/contacts.ts src/tools/addresses.ts src/tools/users.ts src/index.ts
git commit -m "feat: add contact, address, and user tools"
```

---

### Task 9: Artikel, Assets, Projekte, Kategorien

**Files:**
- Create: `src/tools/articles.ts`
- Create: `src/tools/assets.ts`
- Create: `src/tools/projects.ts`
- Create: `src/tools/categories.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: articles.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerArticleTools(server: McpServer) {
  server.tool("search_articles", "Artikel suchen.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/article/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_article", "Artikel anlegen.",
    {
      title: z.string().describe("Artikelname (Pflicht)"),
      unitid: z.number().describe("Einheit: 1=Stück, 2=Stunden, 3=Pauschale, 4=Km (Pflicht)"),
      units: z.number().describe("Menge/Wert (Pflicht)"),
      price: z.number().optional(),
      description: z.string().optional(),
    },
    async (body) => {
      const data = await apiPost("/api2/article/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_article", "Artikel aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/article/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: assets.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerAssetTools(server: McpServer) {
  server.tool("search_assets", "Geräte/Assets suchen.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/asset/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_asset", "Gerät anlegen.",
    {
      name: z.string().describe("Gerätename (Pflicht)"),
      customerid: z.number().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
    },
    async (body) => {
      const data = await apiPost("/api2/asset/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_asset", "Gerät aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/asset/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 3: projects.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerProjectTools(server: McpServer) {
  server.tool("search_projects", "Projekte suchen.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/project/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_project", "Projekt anlegen.",
    {
      Title: z.string().describe("Projekttitel (Pflicht)"),
      Description: z.string().optional(),
      Duration: z.number().optional().describe("Geschätzte Stunden"),
      Begin: z.string().optional().describe("Startdatum: DD.MM.YYYY HH:mm:ss"),
    },
    async (body) => {
      const data = await apiPost("/api2/project/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_project", "Projekt aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/project/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 4: categories.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerCategoryTools(server: McpServer) {
  server.tool("search_categories", "Kategorien suchen.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/categorie/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_category", "Kategorie anlegen.",
    { fields: z.record(z.unknown()) },
    async ({ fields }) => {
      const data = await apiPost("/api2/categorie/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_category", "Kategorie aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/categorie/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 5: In index.ts registrieren**

```typescript
import { registerArticleTools } from "./tools/articles.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerCategoryTools } from "./tools/categories.js";
// ...
registerArticleTools(server);
registerAssetTools(server);
registerProjectTools(server);
registerCategoryTools(server);
```

- [ ] **Schritt 6: Kompilierung prüfen**

```bash
npx tsc --noEmit
```

- [ ] **Schritt 7: Committen**

```bash
git add src/tools/articles.ts src/tools/assets.ts src/tools/projects.ts src/tools/categories.ts src/index.ts
git commit -m "feat: add article, asset, project, and category tools"
```

---

### Task 10: Status, Prioritäten, Typen

**Files:**
- Create: `src/tools/status.ts`
- Create: `src/tools/priorities.ts`
- Create: `src/tools/types.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: status.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerStatusTools(server: McpServer) {
  server.tool("search_ticket_status", "Ticketstatus auflisten.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/ticketstatus/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_ticket_status", "Ticketstatus anlegen.",
    { fields: z.record(z.unknown()) },
    async ({ fields }) => {
      const data = await apiPost("/api2/ticketstatus/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_ticket_status", "Ticketstatus aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/ticketstatus/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: priorities.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerPriorityTools(server: McpServer) {
  server.tool("search_priorities", "Prioritäten auflisten.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/ticketpriority/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_priority", "Priorität anlegen.",
    { fields: z.record(z.unknown()) },
    async ({ fields }) => {
      const data = await apiPost("/api2/ticketpriority/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_priority", "Priorität aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/ticketpriority/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 3: types.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerTypeTools(server: McpServer) {
  server.tool("search_ticket_types", "Tickettypen auflisten.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/tickettype/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_ticket_type", "Tickettyp anlegen.",
    { fields: z.record(z.unknown()) },
    async ({ fields }) => {
      const data = await apiPost("/api2/tickettype/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_ticket_type", "Tickettyp aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/tickettype/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("search_timer_types", "Timertypen auflisten.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/TimerType/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 4: In index.ts registrieren**

```typescript
import { registerStatusTools } from "./tools/status.js";
import { registerPriorityTools } from "./tools/priorities.js";
import { registerTypeTools } from "./tools/types.js";
// ...
registerStatusTools(server);
registerPriorityTools(server);
registerTypeTools(server);
```

- [ ] **Schritt 5: Kompilierung prüfen und committen**

```bash
npx tsc --noEmit
git add src/tools/status.ts src/tools/priorities.ts src/tools/types.ts src/index.ts
git commit -m "feat: add status, priority, and type tools"
```

---

### Task 11: E-Mail, Webhooks, Vorlagen, Checklisten

**Files:**
- Create: `src/tools/email.ts`
- Create: `src/tools/webhooks.ts`
- Create: `src/tools/templates.ts`
- Create: `src/tools/checklists.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: email.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost } from "../client.js";

export function registerEmailTools(server: McpServer) {
  server.tool("send_email", "E-Mail über Visoma versenden.",
    {
      to: z.string().describe("Empfänger-E-Mail (Pflicht)"),
      subject: z.string().optional(),
      body: z.string().optional(),
      cc: z.string().optional(),
      ticketId: z.number().optional(),
      template: z.number().optional().describe("Nachrichten-Vorlagen-ID"),
      save: z.number().optional().describe("In DB speichern: 0 oder 1"),
    },
    async (body) => {
      const data = await apiPost("/api2/do/function/sendMail", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("search_messages", "E-Mails zu einem Ticket suchen.",
    { ticketId: z.number().describe("Ticket-ID") },
    async ({ ticketId }) => {
      const data = await apiGet(`/api2/message/search/params[ticketid]/${ticketId}/`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("get_unread_messages", "Ungelesene E-Mails abrufen.", {},
    async () => {
      const data = await apiGet("/api2/message/search/unseen/1/");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: webhooks.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerWebhookTools(server: McpServer) {
  server.tool("search_webhooks", "Webhooks auflisten.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/webhooks/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_webhook", "Webhook anlegen.",
    {
      model: z.enum(["Ticket", "RmmFailedcheck"]).describe("Modell, das beobachtet wird"),
      action: z.enum(["INSERT", "UPDATE", "DELETE"]),
      attribute: z.string().describe("Zu beobachtendes Feld"),
      url: z.string().describe("Ziel-URL"),
      modelid: z.number().optional(),
    },
    async (body) => {
      const data = await apiPost("/api2/webhooks/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_webhook", "Webhook aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/webhooks/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("get_webhook_attributes", "Verfügbare Webhook-Attribute abrufen.", {},
    async () => {
      const data = await apiGet("/api2/do/function/WebhooksAttributeList");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 3: templates.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../client.js";

export function registerTemplateTools(server: McpServer) {
  server.tool("search_message_templates", "Nachrichtenvorlagen auflisten.", {},
    async () => {
      const data = await apiGet("/api2/messagetemplates/search/");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("search_text_templates", "Textbausteine auflisten.", {},
    async () => {
      const data = await apiGet("/api2/texttemplates/search/");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 4: checklists.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerChecklistTools(server: McpServer) {
  server.tool("search_checklist_templates", "Checklisten-Vorlagen suchen.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/checklisttemplate/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_checklist_template", "Checklisten-Vorlage anlegen.",
    { fields: z.record(z.unknown()) },
    async ({ fields }) => {
      const data = await apiPost("/api2/checklisttemplate/", fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_checklist_template", "Checklisten-Vorlage aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/checklisttemplate/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 5: In index.ts registrieren**

```typescript
import { registerEmailTools } from "./tools/email.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerChecklistTools } from "./tools/checklists.js";
// ...
registerEmailTools(server);
registerWebhookTools(server);
registerTemplateTools(server);
registerChecklistTools(server);
```

- [ ] **Schritt 6: Kompilierung prüfen und committen**

```bash
npx tsc --noEmit
git add src/tools/email.ts src/tools/webhooks.ts src/tools/templates.ts src/tools/checklists.ts src/index.ts
git commit -m "feat: add email, webhook, template, and checklist tools"
```

---

### Task 12: Concept-Office, RMM, Volltextsuche

**Files:**
- Create: `src/tools/conceptoffice.ts`
- Create: `src/tools/rmm.ts`
- Create: `src/tools/search.ts`
- Modify: `src/index.ts`

- [ ] **Schritt 1: conceptoffice.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, buildFilterPath } from "../client.js";

export function registerConceptOfficeTools(server: McpServer) {
  server.tool("search_conceptoffice_times", "Zeiten für Concept-Office-Export abrufen. exported=0 für noch nicht exportierte Zeiten.",
    { onlyUnexported: z.boolean().optional().describe("Nur noch nicht exportierte Zeiten abrufen (Standard: false)") },
    async ({ onlyUnexported }) => {
      const path = onlyUnexported
        ? "/api2/conceptoffice/search/params[exported]/0/"
        : "/api2/conceptoffice/search/";
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("mark_times_as_exported", "Zeiten als nach Concept-Office exportiert markieren.",
    { ids: z.array(z.number()).describe("Array der Timer-IDs") },
    async ({ ids }) => {
      const data = await apiPost("/api2/do/function/markasexported", { ids });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 2: rmm.ts anlegen**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerRmmTools(server: McpServer) {
  server.tool("search_rmm_checks", "Fehlgeschlagene RMM-Checks suchen.",
    { filters: z.record(z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/rmmfailedcheck/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_rmm_check", "Fehlgeschlagenen RMM-Check melden.",
    {
      sync_id: z.string().describe("ID aus dem RMM-System (Pflicht)"),
      sync_source: z.number().describe("Erlaubte Werte: 1, 2, 3, 4 (Pflicht)"),
      customerid: z.number().optional(),
      ticketid: z.number().optional(),
    },
    async (body) => {
      const data = await apiPost("/api2/rmmfailedcheck/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_rmm_check", "RMM-Check aktualisieren.",
    { id: z.number(), fields: z.record(z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/rmmfailedcheck/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("clear_rmm_check", "RMM-Check zurücksetzen.",
    {
      sync_id: z.string(),
      sync_source: z.string(),
    },
    async (body) => {
      const data = await apiPost("/api2/do/function/clearRmmFailedcheck", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 3: search.ts anlegen (Elasticsearch)**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getBasicAuthHeaders } from "../client.js";

const BASE_URL = process.env.VISOMA_BASE_URL?.replace(/\/$/, "");

export function registerSearchTools(server: McpServer) {
  server.tool(
    "fulltext_search",
    "Elasticsearch-Volltextsuche über Tickets, Kunden, Projekte, Kontakte und Dokumente. Erfordert VISOMA_USERNAME und VISOMA_PASSWORD.",
    {
      term: z.string().describe("Suchbegriff (unterstützt erweiterte Suchsyntax)"),
    },
    async ({ term }) => {
      const headers = getBasicAuthHeaders();
      const url = new URL(`${BASE_URL}/elasearch/`);
      url.searchParams.set("term", term);
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

- [ ] **Schritt 4: In index.ts registrieren**

```typescript
import { registerConceptOfficeTools } from "./tools/conceptoffice.js";
import { registerRmmTools } from "./tools/rmm.js";
import { registerSearchTools } from "./tools/search.js";
// ...
registerConceptOfficeTools(server);
registerRmmTools(server);
registerSearchTools(server);
```

- [ ] **Schritt 5: Kompilierung prüfen und committen**

```bash
npx tsc --noEmit
git add src/tools/conceptoffice.ts src/tools/rmm.ts src/tools/search.ts src/index.ts
git commit -m "feat: add concept-office, RMM, and fulltext search tools"
```

---

### Task 13: Build & finaler Test

**Files:**
- Modify: `package.json` (tsup-Konfiguration prüfen)

- [ ] **Schritt 1: Produktions-Build erstellen**

```bash
npm run build
```

Erwartung: `dist/index.js` wird erstellt, keine Fehler.

- [ ] **Schritt 2: Server mit MCP Inspector testen**

```bash
VISOMA_BASE_URL=https://firma.visoma-tickets.de VISOMA_TOKEN=dein-token npx @modelcontextprotocol/inspector node dist/index.js
```

Erwartung: Inspector öffnet sich, zeigt alle ~50 Tools an.  
Mindestens `search_tickets` und `search_customers` manuell aufrufen und prüfen, dass echte Daten zurückkommen.

- [ ] **Schritt 3: README.md anlegen**

```markdown
# mcp-visomatickets

MCP-Server für die Visoma Tickets API. Exponiert alle API-Endpunkte als MCP-Tools für Claude.

## Setup

\`\`\`bash
npm install
npm run build
\`\`\`

## Konfiguration (claude_desktop_config.json)

\`\`\`json
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
\`\`\`

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| VISOMA_BASE_URL | Ja | Basis-URL der Visoma-Instanz |
| VISOMA_TOKEN | Ja | API-Token aus Admin-Einstellungen |
| VISOMA_USERNAME | Nein | Nur für fulltext_search |
| VISOMA_PASSWORD | Nein | Nur für fulltext_search |
```

- [ ] **Schritt 4: Alles committen und pushen**

```bash
git add README.md dist/
git commit -m "feat: production build and README"
git push -u origin main
```
