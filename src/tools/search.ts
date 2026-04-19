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
      const res = await fetch(url.toString(), { headers, redirect: "manual" });
      if (res.status === 301 || res.status === 302) {
        throw new Error(
          "Der /elasearch/-Endpoint erfordert eine Browser-Session und ist per API nicht zugänglich. " +
          "Bitte verwende stattdessen: search_tickets, search_customers, search_projects, search_contacts."
        );
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
