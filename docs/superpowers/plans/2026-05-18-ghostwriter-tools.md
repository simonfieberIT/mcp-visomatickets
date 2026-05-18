# Ghostwriter Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new Ghostwriter MCP tools and a session-based HTTP client so the billing workflow (fetch pending, set article, release, close) works entirely without a Chrome browser.

**Architecture:** A new `VisomaSession` class in `src/session.ts` manages cookie-jar login and form-encoded POSTs to Visoma's HTML endpoints. It is instantiated once (lazy login) in `src/index.ts` and injected into `registerGhostwriterTools`. The existing REST client (`src/client.ts`) is untouched.

**Tech Stack:** TypeScript 5, `@modelcontextprotocol/sdk`, `zod`, Node.js built-in `fetch` (no new dependencies), `tsup` build.

**Spec:** `docs/superpowers/specs/2026-05-18-ghostwriter-tools-design.md`

---

### Task 1: `src/session.ts` — VisomaSession cookie-jar client

**Goal:** Implement `VisomaSession` — a class that handles Yii login, cookie-jar management, and form-encoded POSTs to Visoma HTML endpoints.

**Files:**
- Create: `src/session.ts`

**Acceptance Criteria:**
- [ ] `VisomaSession` is exported from `src/session.ts`
- [ ] `SessionExpiredError` is exported from `src/session.ts`
- [ ] `login()` GETs `/site/login`, extracts CSRF token, POSTs credentials, stores `Set-Cookie` headers
- [ ] `login()` throws if response to POST is not HTTP 302
- [ ] `ensureLoggedIn()` calls `login()` only if not yet logged in (lazy, idempotent)
- [ ] `postForm()` sends `Content-Type: application/x-www-form-urlencoded; charset=UTF-8` and `X-Requested-With: XMLHttpRequest`
- [ ] `postForm()` auto-appends `_csrf` cookie value to params if `YII_CSRF_TOKEN` cookie is present
- [ ] `postForm()` throws `SessionExpiredError` when response is HTTP 302 with `Location` containing `/site/login`
- [ ] `postForm()` throws on non-200/302 responses
- [ ] `npm run build` succeeds

**Verify:** `npm run build` → exit 0, no TypeScript errors

**Steps:**

- [ ] **Step 1: Create `src/session.ts`**

```typescript
const BASE_URL = process.env.VISOMA_BASE_URL?.replace(/\/$/, "");
const USERNAME = process.env.VISOMA_USERNAME;
const PASSWORD = process.env.VISOMA_PASSWORD;

export class SessionExpiredError extends Error {
  constructor() {
    super("Visoma session expired — re-login required");
    this.name = "SessionExpiredError";
  }
}

export class VisomaSession {
  private cookies: Record<string, string> = {};
  private loggedIn = false;

  async ensureLoggedIn(): Promise<void> {
    if (!this.loggedIn) {
      await this.login();
    }
  }

  async login(): Promise<void> {
    if (!BASE_URL || !USERNAME || !PASSWORD) {
      throw new Error(
        "VISOMA_BASE_URL, VISOMA_USERNAME, and VISOMA_PASSWORD are required for Ghostwriter tools. " +
        "VISOMA_USERNAME/PASSWORD must be a service account with 2FA disabled."
      );
    }

    // Step 1: GET login page — collect initial cookies and CSRF token
    const loginPageRes = await fetch(`${BASE_URL}/site/login`, {
      method: "GET",
      redirect: "manual",
      headers: { Cookie: this.cookieHeader() },
    });
    this.mergeCookies(loginPageRes.headers.getSetCookie?.() ?? []);
    const html = await loginPageRes.text();

    // Extract CSRF token from hidden input or meta tag
    const csrfMatch =
      html.match(/<input[^>]+name="YII_CSRF_TOKEN"[^>]+value="([^"]+)"/) ||
      html.match(/name="csrf-token"[^>]+content="([^"]+)"/) ||
      html.match(/content="([^"]+)"[^>]+name="csrf-token"/);
    if (!csrfMatch) {
      throw new Error("Could not extract CSRF token from Visoma login page");
    }
    const csrfToken = csrfMatch[1];

    // Step 2: POST credentials
    const body = new URLSearchParams({
      "LoginForm[username]": USERNAME,
      "LoginForm[password]": PASSWORD,
      "LoginForm[rememberMe]": "1",
      YII_CSRF_TOKEN: csrfToken,
    });

    const loginRes = await fetch(`${BASE_URL}/site/login`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: this.cookieHeader(),
      },
      body: body.toString(),
    });
    this.mergeCookies(loginRes.headers.getSetCookie?.() ?? []);

    if (loginRes.status !== 302) {
      throw new Error(
        `Visoma login failed: expected HTTP 302 redirect, got ${loginRes.status}. ` +
        "Check VISOMA_USERNAME/PASSWORD and ensure 2FA is disabled for this account."
      );
    }

    this.loggedIn = true;
  }

  async postForm(
    path: string,
    params: URLSearchParams
  ): Promise<{ status: number; body: string }> {
    if (!BASE_URL) throw new Error("VISOMA_BASE_URL is required");

    // Auto-append _csrf from cookie jar if available
    const csrfCookie = this.cookies["YII_CSRF_TOKEN"];
    if (csrfCookie && !params.has("_csrf")) {
      params.append("_csrf", csrfCookie);
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: this.cookieHeader(),
      },
      body: params.toString(),
    });
    this.mergeCookies(res.headers.getSetCookie?.() ?? []);

    if (res.status === 302) {
      const location = res.headers.get("location") ?? "";
      if (location.includes("/site/login")) {
        this.loggedIn = false;
        throw new SessionExpiredError();
      }
      // Other 302s are unexpected but non-fatal — treat as success
    }

    if (res.status !== 200 && res.status !== 302) {
      throw new Error(`HTTP ${res.status} for POST ${path}`);
    }

    const body = await res.text();
    return { status: res.status, body };
  }

  private mergeCookies(setCookieHeaders: string[]): void {
    for (const header of setCookieHeaders) {
      const [pair] = header.split(";");
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      this.cookies[name] = value;
    }
  }

  private cookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exit 0, no TypeScript errors.

> **Note on `getSetCookie()`:** `Headers.getSetCookie()` is available in Node.js 18.14+ and included in `@types/node` v25. If you see a type error, cast: `(res.headers as Headers & { getSetCookie(): string[] }).getSetCookie?.() ?? []`

- [ ] **Step 3: Commit**

```bash
git add src/session.ts
git commit -m "feat: add VisomaSession for cookie-based Ghostwriter auth"
```

---

### Task 2: `src/tools/ghostwriter.ts` — four new Ghostwriter tools

**Goal:** Add `ghostwriter_get_pending`, `set_ghostwriter_article`, `ghostwriter_close_timers`, and `ghostwriter_release_timers` to the existing ghostwriter tool module.

**Files:**
- Modify: `src/tools/ghostwriter.ts`

**Acceptance Criteria:**
- [ ] `registerGhostwriterTools` accepts a second `session: VisomaSession` parameter
- [ ] `ghostwriter_get_pending` calls `apiGet` (REST token auth), filters `ininvoice === 0` client-side, supports optional `customer_id` and `limit` (default 500)
- [ ] `set_ghostwriter_article` calls `session.postForm` with `pk`, `name=articleid`, `value`
- [ ] `ghostwriter_close_timers` executes the two-step `closewithoutinvoice` flow; parses `ticketids[]` from step-1 HTML (no type restriction); retries once on `SessionExpiredError`
- [ ] `ghostwriter_release_timers` executes the two-step `addtoque` flow; HTML-entity-decodes `Ghostwriter[amounts]` from step-1 HTML; retries once on `SessionExpiredError`
- [ ] Both two-step tools accept optional `returnUrl` (default `"6a0ada08876a2"`)
- [ ] `npm run build` succeeds

**Verify:** `npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Replace `src/tools/ghostwriter.ts` entirely with the following**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, buildFilterPath } from "../client.js";
import { VisomaSession, SessionExpiredError } from "../session.js";

export function registerGhostwriterTools(server: McpServer, session: VisomaSession) {
  // ── Existing tool (unchanged) ──────────────────────────────────────────────

  server.tool(
    "search_ghostwriter",
    "Abrechnungsübersicht abrufen. Enthält Zeiteinträge mit Ticket-, Kunden-, Vertrags- und Abrechnungsinformationen. Filter z. B. billable, ininvoice, customerid, userid, startdate, contractid.",
    {
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe(
        'Filter als Objekt, z. B. { "billable": 1, "ininvoice": 0, "customerid": 42, "QueryLimit": 100 }'
      ),
    },
    async ({ filters }) => {
      const path = `/api2/ghostwriter/search${filters ? "/" + buildFilterPath(filters) : "/"}`;
      const data = await apiGet(path);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  // ── New tools ──────────────────────────────────────────────────────────────

  server.tool(
    "ghostwriter_get_pending",
    "Offene Ghostwriter-Einträge abrufen (noch nicht freigegeben oder geschlossen). " +
    "Hinweis: Der ininvoice-Filter der Visoma-API wird serverseitig ignoriert — die Filterung erfolgt client-seitig auf dem Feld ininvoice===0. " +
    "QueryLimit ist standardmäßig 500 und deckt typische Tagesabschlussmengen (10–200 Einträge) ab.",
    {
      customer_id: z.number().optional().describe("Nur Einträge für diesen Kunden (customerid)"),
      limit: z.number().optional().describe("Maximale Anzahl Einträge (Standard: 500)"),
    },
    async ({ customer_id, limit = 500 }) => {
      // Build filter path: customerid first (if given), then QueryLimit
      // Example: /api2/ghostwriter/search/params[customerid]/42/params[QueryLimit]/500/
      const filters: Record<string, string | number> = {};
      if (customer_id !== undefined) filters["customerid"] = customer_id;
      filters["QueryLimit"] = limit;
      const path = `/api2/ghostwriter/search/${buildFilterPath(filters)}`;
      const data = await apiGet(path) as { data?: unknown[] } | unknown[];
      // Normalise: API may return array directly or { data: [...] }
      const rows = Array.isArray(data) ? data : (data as { data?: unknown[] }).data ?? [];
      const pending = (rows as Array<Record<string, unknown>>).filter(
        (row) => row["ininvoice"] === 0 || row["ininvoice"] === "0"
      );
      return {
        content: [{
          type: "text",
          text: JSON.stringify(
            { total_returned: rows.length, pending_count: pending.length, entries: pending },
            null,
            2
          ),
        }],
      };
    }
  );

  server.tool(
    "set_ghostwriter_article",
    "Tätigkeit (Artikel) eines Ghostwriter-Eintrags setzen. Benötigt VISOMA_USERNAME/PASSWORD (Service-Account, 2FA deaktiviert).",
    {
      timer_id: z.number().describe("Timer-ID des Ghostwriter-Eintrags"),
      article_id: z.number().describe("Artikel-ID der Tätigkeit (z. B. 68589 für IT-Service)"),
    },
    async ({ timer_id, article_id }) => {
      await session.ensureLoggedIn();
      const params = new URLSearchParams({
        pk: String(timer_id),
        name: "articleid",
        value: String(article_id),
      });
      try {
        const result = await session.postForm("/Ghostwriter/editServiceArticle", params);
        return { content: [{ type: "text", text: `OK (HTTP ${result.status})` }] };
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await session.login();
          const result = await session.postForm("/Ghostwriter/editServiceArticle", params);
          return { content: [{ type: "text", text: `OK (HTTP ${result.status}, nach Re-Login)` }] };
        }
        throw e;
      }
    }
  );

  server.tool(
    "ghostwriter_close_timers",
    "Ghostwriter-Einträge ohne Abrechnung schließen (Kulanz / nicht abrechenbar). Führt den Visoma closewithoutinvoice-Flow aus (2 Schritte). " +
    "returnUrl: stabiler Hash aus dem Ghostwriter-JavaScript. Falls deine Instanz abweicht, lies ihn aus den Script-Tags der Ghostwriter-Seite als String-Literal in der Form /returnUrl/[hash]/.",
    {
      timer_ids: z.array(z.number()).describe("Liste der Timer-IDs die geschlossen werden sollen"),
      returnUrl: z.string().optional().describe('Ghostwriter returnUrl-Hash (Standard: "6a0ada08876a2")'),
    },
    async ({ timer_ids, returnUrl = "6a0ada08876a2" }) => {
      await session.ensureLoggedIn();
      const path = `/Ghostwriter/closewithoutinvoice/returnUrl/${returnUrl}`;

      const executeClose = async (): Promise<number[]> => {
        // Step 1: Load modal — get ticketids from HTML response
        const step1Params = new URLSearchParams({
          attribute: "5",
          gridid: "",
          oldgridid: "",
          formdata: "",
        });
        timer_ids.forEach((id) => step1Params.append("Ghostwriter[id][]", String(id)));
        timer_ids.forEach((id, i) => {
          step1Params.append(`amounts[${i}][id]`, String(id));
          step1Params.append(`amounts[${i}][amount]`, "");
        });

        const step1 = await session.postForm(path, step1Params);

        // Parse ticketids[] — no type restriction (can be text or hidden input)
        const ticketIdMatches = [...step1.body.matchAll(/name="ticketids\[\]"[^>]*value="(\d+)"/g)];
        const ticketIds = ticketIdMatches.map((m) => m[1]);

        if (ticketIds.length === 0) {
          throw new Error(
            "Keine ticketids[] im Step-1-Response gefunden. " +
            "Prüfe ob die Timer-IDs im Ghostwriter sichtbar sind und der returnUrl-Hash korrekt ist."
          );
        }

        // Step 2: Execute close
        const step2Params = new URLSearchParams({
          "Ghostwriter[id]": timer_ids.join(","),
          action: "save",
          returnUrl,
        });
        ticketIds.forEach((id) => step2Params.append("ticketids[]", id));

        await session.postForm(path, step2Params);
        return timer_ids;
      };

      try {
        const closedIds = await executeClose();
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, closed_ids: closedIds }) }],
        };
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await session.login();
          const closedIds = await executeClose();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ success: true, closed_ids: closedIds, note: "Re-Login erforderlich" }),
            }],
          };
        }
        throw e;
      }
    }
  );

  server.tool(
    "ghostwriter_release_timers",
    "Ghostwriter-Einträge zur Abrechnung freigeben (addtoque). Führt den Visoma-Flow in 2 Schritten aus. " +
    "amount: abzurechnende Stunden — kann kleiner sein als die Timer-Dauer (Teilabrechnung). " +
    "returnUrl: stabiler Hash aus dem Ghostwriter-JavaScript. Falls deine Instanz abweicht, lies ihn aus den Script-Tags der Ghostwriter-Seite als String-Literal in der Form /returnUrl/[hash]/.",
    {
      timers: z.array(z.object({
        id: z.number().describe("Timer-ID"),
        amount: z.number().describe("Abzurechnende Stunden (z. B. 2.5 oder 0.5 für Teilabrechnung)"),
      })).describe("Liste der freizugebenden Timer mit Beträgen"),
      returnUrl: z.string().optional().describe('Ghostwriter returnUrl-Hash (Standard: "6a0ada08876a2")'),
    },
    async ({ timers, returnUrl = "6a0ada08876a2" }) => {
      await session.ensureLoggedIn();
      const path = `/Ghostwriter/addtoque/returnUrl/${returnUrl}`;
      const timerIds = timers.map((t) => t.id);

      const executeRelease = async (): Promise<number[]> => {
        // Step 1: Load modal — server returns validated Ghostwriter[amounts] JSON
        const step1Params = new URLSearchParams({
          attribute: "1",
          gridid: "",
          oldgridid: "",
          formdata: "",
        });
        timerIds.forEach((id) => step1Params.append("Ghostwriter[id][]", String(id)));
        timers.forEach((t, i) => {
          step1Params.append(`amounts[${i}][id]`, String(t.id));
          step1Params.append(`amounts[${i}][amount]`, t.amount.toFixed(2));
        });

        const step1 = await session.postForm(path, step1Params);

        // Parse Ghostwriter[amounts] — value is HTML-entity-encoded JSON
        // e.g. value="{&quot;13001&quot;:&quot;2.50&quot;}"
        const amountsMatch = step1.body.match(/name="Ghostwriter\[amounts\]"[^>]*value="([^"]*)"/);
        if (!amountsMatch) {
          throw new Error(
            "Ghostwriter[amounts] nicht im Step-1-Response gefunden. " +
            "Prüfe ob die Timer-IDs im Ghostwriter sichtbar sind und der returnUrl-Hash korrekt ist."
          );
        }
        // HTML-entity-decode before passing to step 2
        const amountsJson = amountsMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">");

        // Step 2: Execute release — pass server's amounts JSON as-is (do not reconstruct)
        const step2Params = new URLSearchParams({
          "Ghostwriter[id]": timerIds.join(","),
          action: "save",
          "Ghostwriter[amounts]": amountsJson,
          returnUrl,
        });

        await session.postForm(path, step2Params);
        return timerIds;
      };

      try {
        const releasedIds = await executeRelease();
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, released_ids: releasedIds }) }],
        };
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          await session.login();
          const releasedIds = await executeRelease();
          return {
            content: [{
              type: "text",
              text: JSON.stringify({ success: true, released_ids: releasedIds, note: "Re-Login erforderlich" }),
            }],
          };
        }
        throw e;
      }
    }
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exit 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/tools/ghostwriter.ts
git commit -m "feat: add ghostwriter_get_pending, set_ghostwriter_article, ghostwriter_close_timers, ghostwriter_release_timers"
```

---

### Task 3: Wire session into `src/index.ts` and update `.env.example`

**Goal:** Create the `VisomaSession` singleton in `index.ts`, inject it into `registerGhostwriterTools`, and document the 2FA service account requirement in `.env.example`.

**Files:**
- Modify: `src/index.ts`
- Modify: `.env.example`

**Acceptance Criteria:**
- [ ] `VisomaSession` imported and instantiated before tool registration in `src/index.ts`
- [ ] `registerGhostwriterTools(server, session)` called with session instance
- [ ] All other `registerX(server)` calls unchanged
- [ ] `.env.example` VISOMA_USERNAME/PASSWORD comment mentions service account and 2FA disabled
- [ ] `npm run build` succeeds

**Verify:** `npm run build` → exit 0

**Steps:**

- [ ] **Step 1: Update `src/index.ts`**

Add the import and instance. Only two lines change; all other lines stay identical:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { VisomaSession } from "./session.js";           // ADD
import { registerTicketTools } from "./tools/tickets.js";
import { registerTimerTools } from "./tools/timers.js";
import { registerGhostwriterTools } from "./tools/ghostwriter.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerAddressTools } from "./tools/addresses.js";
import { registerUserTools } from "./tools/users.js";
import { registerArticleTools } from "./tools/articles.js";
import { registerAssetTools } from "./tools/assets.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerStatusTools } from "./tools/status.js";
import { registerPriorityTools } from "./tools/priorities.js";
import { registerTypeTools } from "./tools/types.js";
import { registerEmailTools } from "./tools/email.js";
import { registerWebhookTools } from "./tools/webhooks.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerChecklistTools } from "./tools/checklists.js";
import { registerConceptOfficeTools } from "./tools/conceptoffice.js";
import { registerRmmTools } from "./tools/rmm.js";
import { registerSearchTools } from "./tools/search.js";
import { registerUserGroupTools } from "./tools/usergroups.js";

const server = new McpServer({
  name: "visoma-tickets",
  version: "0.1.0",
});

const session = new VisomaSession();                    // ADD — lazy, no login on startup

registerTicketTools(server);
registerTimerTools(server);
registerGhostwriterTools(server, session);              // CHANGE — add session
registerInvoiceTools(server);
registerCustomerTools(server);
registerContactTools(server);
registerAddressTools(server);
registerUserTools(server);
registerArticleTools(server);
registerAssetTools(server);
registerProjectTools(server);
registerCategoryTools(server);
registerStatusTools(server);
registerPriorityTools(server);
registerTypeTools(server);
registerEmailTools(server);
registerWebhookTools(server);
registerTemplateTools(server);
registerChecklistTools(server);
registerConceptOfficeTools(server);
registerRmmTools(server);
registerSearchTools(server);
registerUserGroupTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 2: Update `.env.example`**

Replace the existing USERNAME/PASSWORD lines with:

```env
VISOMA_BASE_URL=https://firma.visoma-tickets.de
VISOMA_TOKEN=dein-token-hier
# Ghostwriter HTML-Endpoints + Timer-Start (Session-Authentifizierung)
# WICHTIG: Muss ein Service-Account sein — 2FA muss für diesen Account deaktiviert sein.
VISOMA_USERNAME=service-account-benutzername
VISOMA_PASSWORD=service-account-passwort
```

- [ ] **Step 3: Final build verification**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts .env.example
git commit -m "feat: wire VisomaSession into index.ts, document service account requirement"
```

---

## Integration Testing Guide

No automated test suite. After all tasks complete, verify with real credentials:

**Prerequisites:** Service account created in Visoma admin with 2FA disabled. `.env` file with real values for `VISOMA_BASE_URL`, `VISOMA_USERNAME`, `VISOMA_PASSWORD`.

**Test 1 — Session login (quick smoke test):**
```bash
node --input-type=module <<'EOF'
import { VisomaSession } from './dist/session.js';
const s = new VisomaSession();
await s.login().then(() => console.log('Login OK')).catch(e => { console.error('FAIL:', e.message); process.exit(1); });
EOF
```
Expected: `Login OK`

**Test 2 — `ghostwriter_get_pending`:** Call via MCP client with no arguments. Expect JSON with `pending_count` and `entries` array. Confirm `pending_count` matches what you see in the Ghostwriter UI.

**Test 3 — `set_ghostwriter_article`:** Call with a known `timer_id` and `article_id: 68589`. Expect `OK (HTTP 200)`. Verify in Visoma UI that the article changed.

**Test 4 — `ghostwriter_close_timers`:** Call with one non-billable timer ID. Expect `{ "success": true, "closed_ids": [...] }`. Verify entry is closed in Visoma.

**Test 5 — `ghostwriter_release_timers`:** Call with `{ "timers": [{ "id": 12345, "amount": 1.0 }] }`. Expect `{ "success": true, "released_ids": [...] }`. Verify entry appears in the billing queue.
