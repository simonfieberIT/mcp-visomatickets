import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, buildFilterPath } from "../client.js";

export function registerInvoiceTools(server: McpServer) {
  server.tool(
    "search_invoices",
    "Leistungsnachweise (fertige Rechnungsdokumente) suchen.",
    {
      filters: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe(
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
