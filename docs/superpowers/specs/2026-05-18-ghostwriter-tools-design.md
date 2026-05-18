# Ghostwriter Tools — Design Spec

**Date:** 2026-05-18  
**Goal:** Extend the Visoma MCP Connector with Ghostwriter billing workflow tools, eliminating the need for a Chrome browser to release or close timers.

---

## Background

The Ghostwriter is Visoma's billing module (`/ghostwriter/index/`). Technicians log time in tickets; after a day-end close, entries appear in the Ghostwriter for accounting approval.

**Current workflow (before this change):**
1. Fetch entries (`search_ghostwriter`)
2. Set service article per entry (`editServiceArticle` — missing from codebase despite being described as available)
3. Release billable entries (`addtoque`) — Chrome only
4. Close non-billable entries (`closewithoutinvoice`) — Chrome only

**After this change:** All four steps work via MCP tools, no browser required.

---

## Authentication

### REST API (`/api2/*`)
Token-based: `?token={VISOMA_TOKEN}` query param. Already implemented in `src/client.ts`.

### Ghostwriter HTML Endpoints (`/Ghostwriter/*`)
Session cookie required. Token returns HTTP 302 → `/site/login`. Requires:
- `VISOMA_USERNAME` / `VISOMA_PASSWORD` (already in env, used by `start_timer`)
- **These must be a service account with 2FA disabled.** Personal accounts with 2FA cannot be used for automated login.

### Login Flow (Yii Framework)
1. GET `/site/login` → extract `YII_CSRF_TOKEN` from `<input type="hidden">` or `<meta name="csrf-token">`
2. POST `/site/login` with `LoginForm[username]`, `LoginForm[password]`, `LoginForm[rememberMe]=1`, `YII_CSRF_TOKEN`
3. Expect HTTP 302 (success) — store `Set-Cookie` headers (`PHPSESSID`, `YII_CSRF_TOKEN`)
4. All subsequent Ghostwriter calls include `Cookie` header from jar

Session expiry: on HTTP 302 with `Location` header pointing to `/site/login` → auto-relogin once, retry original request.

---

## Files Changed

| File | Change |
|---|---|
| `src/session.ts` | NEW |
| `src/tools/ghostwriter.ts` | 4 new tools added, 1 existing unchanged |
| `src/index.ts` | Create session instance, inject into ghostwriter |
| `.env.example` | Add 2FA note to USERNAME/PASSWORD |

---

## `src/session.ts`

New file. Owns all cookie-jar and login logic. No Ghostwriter business logic.

### Class: `VisomaSession`

```typescript
class VisomaSession {
  private cookies: Record<string, string> = {};
  private loggedIn = false;

  async ensureLoggedIn(): Promise<void>
  async login(): Promise<void>
  async getHtml(path: string): Promise<string>
  async postForm(path: string, params: URLSearchParams): Promise<{ status: number; body: string }>

  private mergeCookies(setCookieHeaders: string[]): void
  private cookieHeader(): string
}
```

### `login()`
1. GET `{VISOMA_BASE_URL}/site/login` — store cookies, extract CSRF token from HTML
2. POST `{VISOMA_BASE_URL}/site/login` with form body: `LoginForm[username]`, `LoginForm[password]`, `LoginForm[rememberMe]=1`, `YII_CSRF_TOKEN={csrfToken}`
3. Expect HTTP 302. Store new cookies. Set `loggedIn = true`.
4. Throw on non-302 (login failed).

### `postForm(path, params)`
- Headers: `Content-Type: application/x-www-form-urlencoded; charset=UTF-8`, `X-Requested-With: XMLHttpRequest`, `Cookie: {cookieHeader()}`
- Auto-appends `_csrf={cookies['YII_CSRF_TOKEN']}` to params if present
- Calls `handleResponse()`

### `handleResponse()`
- HTTP 302 + `Location` header contains `/site/login` → set `loggedIn = false`, throw `SessionExpiredError`
- Other non-200/302 → throw with status code
- HTTP 200 → return `{ status, body }`

### Retry pattern (in tool handlers)
```typescript
try {
  return await session.postForm(path, params);
} catch (e) {
  if (e instanceof SessionExpiredError) {
    await session.login();
    return await session.postForm(path, params); // once, no further retry
  }
  throw e;
}
```

### `ensureLoggedIn()`
Lazy init: calls `login()` only if `!loggedIn`. Idempotent.

---

## `src/tools/ghostwriter.ts`

Signature change: `registerGhostwriterTools(server: McpServer, session: VisomaSession)`

### Tool 1: `search_ghostwriter` (unchanged)
Existing tool, no changes.

### Tool 2: `ghostwriter_get_pending`
Returns unprocessed Ghostwriter entries (not yet released or closed).

**Endpoint:** `GET /api2/ghostwriter/search/params[QueryLimit]/{limit}/` (limit default: 500)  
**Auth:** REST token (via `apiGet`)  
**Filter:** Optional `customer_id` appended to filter path  
**Client-side filter:** Keep only entries where `ininvoice === 0`

Note: The `ininvoice` filter parameter is silently ignored by the Visoma API server — entries are returned regardless of filter value. Client-side filtering on `ininvoice === 0` is safe because the field is correctly set in the response. Default `QueryLimit: 500` covers typical day-end volumes (10–200 entries). This is documented in the tool description.

**Inputs:**
```typescript
{ customer_id?: number, limit?: number /* default 500 */ }
```

### Tool 3: `set_ghostwriter_article`
Sets the service article (Tätigkeit) on a Ghostwriter entry.

**Endpoint:** `POST /Ghostwriter/editServiceArticle`  
**Auth:** Session cookie  
**Body:** `pk={timer_id}&name=articleid&value={article_id}`

**Inputs:**
```typescript
{ timer_id: number, article_id: number }
```

### Tool 4: `ghostwriter_close_timers`
Closes timer entries without invoicing (non-billable / goodwill).

**Auth:** Session cookie  
**Pattern:** Two-step form submission

**Step 1** — Load modal:
```
POST /Ghostwriter/closewithoutinvoice/returnUrl/{returnUrl}
Body:
  Ghostwriter[id][] = {id}   (repeated per timer)
  attribute = 5
  gridid =
  oldgridid =
  formdata =
  amounts[i][id] = {id}      (repeated per timer)
  amounts[i][amount] =       (empty for close)
```
Parse response HTML: extract all `<input name="ticketids[]">` values (no type restriction — can be text or hidden).

**Step 2** — Execute:
```
POST /Ghostwriter/closewithoutinvoice/returnUrl/{returnUrl}
Body:
  Ghostwriter[id] = "id1,id2,..."   (comma-separated)
  action = save
  ticketids[] = {id}                (repeated, from step 1 parse)
  returnUrl = {returnUrl}
```
Success: HTTP 200, empty body.

**Inputs:**
```typescript
{
  timer_ids: number[],
  returnUrl?: string  // default: "6a0ada08876a2"
}
```

**`returnUrl` note:** The default value is a stable hash extracted from the Ghostwriter JavaScript source. If your instance differs, find the value as a string literal in the form `/returnUrl/[hash]/` in the Ghostwriter page's script tags.

### Tool 5: `ghostwriter_release_timers`
Releases timer entries for invoicing (adds to billing queue).

**Auth:** Session cookie  
**Pattern:** Two-step form submission

**Step 1** — Load modal:
```
POST /Ghostwriter/addtoque/returnUrl/{returnUrl}
Body:
  Ghostwriter[id][] = {id}         (repeated)
  attribute = 1
  gridid =
  oldgridid =
  formdata =
  amounts[i][id] = {id}            (repeated)
  amounts[i][amount] = {amount}    (hours, e.g. "2.50")
```
Parse response HTML: extract `<input name="Ghostwriter[amounts]">` value → HTML-entity-decode → use as-is in Step 2. Do not reconstruct the JSON manually — the server may adjust values internally.

**Step 2** — Execute:
```
POST /Ghostwriter/addtoque/returnUrl/{returnUrl}
Body:
  Ghostwriter[id] = "id1,id2,..."
  action = save
  Ghostwriter[amounts] = {decoded JSON string from step 1}
  returnUrl = {returnUrl}
```
Success: HTTP 200, empty body.

**Inputs:**
```typescript
{
  timers: Array<{ id: number; amount: number }>,
  returnUrl?: string  // default: "6a0ada08876a2"
}
```

**Amount:** Billable hours. Can be less than actual timer duration (partial billing). E.g. `0.50` to bill 30 minutes of a 2-hour entry.

---

## `src/index.ts` Changes

```typescript
import { VisomaSession } from "./session.js";

const session = new VisomaSession(); // lazy — no login on startup

registerGhostwriterTools(server, session);
// all other registerX(server) calls unchanged
```

---

## `.env.example` Update

```env
# Ghostwriter HTML-Endpoints + Timer-Start (Session-Authentifizierung)
# WICHTIG: Muss ein Service-Account sein — 2FA muss für diesen Account deaktiviert sein.
VISOMA_USERNAME=replace_with_service_account_username
VISOMA_PASSWORD=replace_with_service_account_password
```

---

## Known Issues / Out of Scope

- `update_timer` with `Billable: false/0` returns HTTP 500. Workaround: use `ghostwriter_close_timers` instead. Root cause unknown, not investigated.
- Additional Ghostwriter actions (`movetimer`, `backtouser`, `parktimer`, `openwithoutinvoice`, `removeparktimer`) follow the same two-step pattern and can be added without architectural changes.
- `VISOMA_BACKEND_URL` (admin domain) is not needed for any current tool and is not added to env config.

---

## Service Article Reference

| Article ID | Name | Use |
|---|---|---|
| 68589 | IT-Service (1 - Basis) | Standard IT service |
| 306 | An- und Abfahrt | Travel time |
| 68608 | Microsoft 365 (inkl. Teams) | Triggers M365 contract |
| 68609 | Firewallservice | Triggers firewall contract |
| 68645 | NAS-Service | Triggers NAS contract |
| 68649 | Dokumentation | Documentation work |
| 68654 | Reklamation | Goodwill / complaint |
| 68668 | Projektbesprechung | Project meetings |
| 68684 | Allgemeines Telefonat | General calls |
| 391 | Cloud Telefonanlage | Triggers phone system contract |
