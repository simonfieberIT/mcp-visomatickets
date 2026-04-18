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
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
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
