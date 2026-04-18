import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, buildFilterPath } from "../client.js";

export function registerGhostwriterTools(server: McpServer) {
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
}
