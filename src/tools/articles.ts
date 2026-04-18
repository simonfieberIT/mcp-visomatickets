import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerArticleTools(server: McpServer) {
  server.tool("search_articles", "Artikel suchen.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
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
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/article/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
