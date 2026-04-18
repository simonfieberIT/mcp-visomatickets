import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

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
