import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerRmmTools(server: McpServer) {
  server.tool("search_rmm_checks", "Fehlgeschlagene RMM-Checks suchen.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/rmmfailedcheck/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_rmm_check", "Fehlgeschlagenen RMM-Check melden.",
    {
      sync_id: z.string().describe("ID aus dem RMM-System (Pflicht)"),
      sync_source: z.number().describe("Erlaubte Werte: 1=Extern, 2=visoma, 3=N-able, 4=Riverboard (Pflicht)"),
      message: z.string().describe("Fehlermeldung / Nachricht der Meldung (Pflicht)"),
      statusid: z.number().describe("Status: 1=grün, 2=gelb, 3=orange, 4=rot (Pflicht)"),
      customerid: z.number().optional(),
      ticketid: z.number().optional(),
      clientid: z.number().optional().describe("Kunden-ID aus dem Drittsystem"),
      deviceid: z.number().optional(),
      catid: z.number().optional(),
    },
    async (body) => {
      const data = await apiPost("/api2/rmmfailedcheck/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_rmm_check", "RMM-Check aktualisieren.",
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/rmmfailedcheck/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("clear_rmm_check", "RMM-Check zurücksetzen (als behoben markieren).",
    {
      id: z.number().describe("Datenbank-ID des RMM-Checks (Pflicht)"),
      clear_until: z.string().optional().describe("Bis wann zurücksetzen: yyyy-mm-dd hh:ii:00"),
      private_note: z.string().optional().describe("Interne Notiz"),
      public_note: z.string().optional().describe("Öffentliche Notiz"),
    },
    async (body) => {
      const data = await apiPost("/api2/do/function/clearRmmFailedcheck", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
