import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, buildFilterPath } from "../client.js";

export function registerProjectTools(server: McpServer) {
  server.tool("search_projects", "Projekte suchen.",
    { filters: z.record(z.string(), z.union([z.string(), z.number()])).optional() },
    async ({ filters }) => {
      const data = await apiGet(`/api2/project/search/${filters ? buildFilterPath(filters) : ""}`);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("create_project", "Projekt anlegen.",
    {
      Title: z.string().describe("Projekttitel (Pflicht)"),
      Description: z.string().optional(),
      Duration: z.number().optional().describe("Geschätzte Stunden"),
      Begin: z.string().optional().describe("Startdatum: DD.MM.YYYY HH:mm:ss"),
    },
    async (body) => {
      const data = await apiPost("/api2/project/", body);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
  server.tool("update_project", "Projekt aktualisieren.",
    { id: z.number(), fields: z.record(z.string(), z.unknown()) },
    async ({ id, fields }) => {
      const data = await apiPut(`/api2/project/${id}`, fields);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }
  );
}
