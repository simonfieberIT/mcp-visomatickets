import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getBasicAuthHeaders } from "../client.js";

const BASE_URL = process.env.VISOMA_BASE_URL?.replace(/\/$/, "");

export function registerSearchTools(server: McpServer) {
  server.tool(
    "fulltext_search",
    "Elasticsearch-Volltextsuche über Tickets, Kunden, Projekte, Kontakte und Dokumente. Erfordert VISOMA_USERNAME und VISOMA_PASSWORD.",
    {
      term: z.string().describe("Suchbegriff (unterstützt erweiterte Suchsyntax)"),
    },
    async ({ term }) => {
      const headers = getBasicAuthHeaders();
      const url = new URL(`${BASE_URL}/elasearch/`);
      url.searchParams.set("term", term);
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
