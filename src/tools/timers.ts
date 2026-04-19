import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath, getBasicAuthHeaders } from "../client.js";

const BASE_URL = process.env.VISOMA_BASE_URL?.replace(/\/$/, "");

export function registerTimerTools(server: McpServer) {
  server.tool(
    "search_timers",
    "Zeiteinträge (Timer) suchen. Filter z. B. nach TicketId, UserId, Billable.",
    {
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe(
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
      fields: z.record(z.string(), z.unknown()).describe("Zu ändernde Felder, z. B. { Billable: 1, Closed: 1 }"),
    },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/Timer/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "start_timer",
    "Laufenden Timer für einen Benutzer starten (Visoma /api2/Timer/start/). Erfordert VISOMA_USERNAME und VISOMA_PASSWORD. Hinweis: Dieser Endpoint erfordert eine aktive Visoma-Browser-Session und liefert 401, wenn der Benutzer nicht über die nötigen Berechtigungen verfügt. Als Alternative kann create_timer mit Start=jetzt und einer geschätzten Stop-Zeit verwendet werden.",
    {
      ticketid: z.number().optional().describe("Ticket-ID"),
      description: z.string().optional().describe("Beschreibung (Standard: 'Via visoma tickets gestartet und noch nicht beendet.')"),
      typeid: z.number().optional().describe("Timertyp-ID"),
      deviceid: z.number().optional().describe("Geräte-ID"),
      contractid: z.number().optional().describe("Vertrags-ID"),
    },
    async (body) => {
      const headers = { ...getBasicAuthHeaders(), "Content-Type": "application/json" };
      const url = new URL(`${BASE_URL}/api2/Timer/start/`);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        throw new Error(
          "401 Unauthorized: Der Visoma-Benutzer hat keine Berechtigung für /api2/Timer/start/. " +
          "Dieser Endpoint erfordert eine aktive Browser-Session. " +
          "Alternative: create_timer mit Start=jetzt und einer vorläufigen Stop-Zeit verwenden."
        );
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText} for POST /api2/Timer/start/`);
      const data = await res.json() as { Success?: boolean; Message?: string };
      if (data.Success === false) throw new Error(`Visoma API error: ${data.Message ?? "Unknown error"}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
