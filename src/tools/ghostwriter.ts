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
        // ininvoice: 0/"0"/false = not yet processed; true/1/"1" = already in invoice queue
        (row) => row["ininvoice"] === 0 || row["ininvoice"] === "0" || row["ininvoice"] === false
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

        // Parse ticketids[] — attribute-order-independent
        const ticketIds = [...step1.body.matchAll(/<input\b[^>]*>/g)]
          .filter((m) => /name="ticketids\[\]"/.test(m[0]))
          .map((m) => m[0].match(/value="(\d+)"/)?.[1])
          .filter((v): v is string => v !== undefined);

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

        const step2 = await session.postForm(path, step2Params);
        if (step2.body && step2.body.trim().length > 0) {
          const lower = step2.body.toLowerCase();
          if (lower.includes("error") || lower.includes("fehler") || lower.includes("exception")) {
            throw new Error(`Visoma returned error in step-2 response: ${step2.body.slice(0, 300)}`);
          }
        }
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

        // Parse Ghostwriter[amounts] — attribute-order-independent
        // e.g. value="{&quot;13001&quot;:&quot;2.50&quot;}"
        const amountsInputs = [...step1.body.matchAll(/<input\b[^>]*>/g)]
          .find((m) => /name="Ghostwriter\[amounts\]"/.test(m[0]));
        const rawAmountsValue = amountsInputs?.[0]?.match(/value="([^"]*)"/)?.[1];
        if (rawAmountsValue === undefined) {
          throw new Error(
            "Ghostwriter[amounts] nicht im Step-1-Response gefunden. " +
            "Prüfe ob die Timer-IDs im Ghostwriter sichtbar sind und der returnUrl-Hash korrekt ist."
          );
        }
        // HTML-entity-decode before passing to step 2
        const amountsJson = rawAmountsValue
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

        const step2 = await session.postForm(path, step2Params);
        if (step2.body && step2.body.trim().length > 0) {
          const lower = step2.body.toLowerCase();
          if (lower.includes("error") || lower.includes("fehler") || lower.includes("exception")) {
            throw new Error(`Visoma returned error in step-2 response: ${step2.body.slice(0, 300)}`);
          }
        }
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
